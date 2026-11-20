import type { DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type { ExprParseEnv, ScalarExprAst } from "./parse-expression-ast.ts"
import type { ParseAfterAddScalarRelIsInUntyped, ParseNotScalarUntyped } from "./parse-expression-relational.ts"
import type { ParseOtherOpAfterOperand } from "./parse-expression-arith.ts"

/**
 * `a AND b AND c …` / `a OR b OR c …` become a BALANCED tree of binary nodes (depth log2 n), not the left-nested one.
 * A left-nested tree of n operators is n levels deep, and every walk over it (the resolver, `extends ScalarExprAst`
 * checks) nests one instantiation level per operator: TS2589 / TS2321 at about 40 operators (#105, one long WHERE).
 * AND and OR are associative for typing (boolean, nullable when any operand is, first error in source order), so
 * the shape of the tree changes nothing but its depth.
 *
 * The operands are collected tail-recursively (as #48 did with ForceProps) in a short tuple `Items`; every
 * {@link BoolChainChunk} operands it is balanced into one node and moved to `Done`. Two things are required (#105):
 * a tuple that grows by one at every operator is copied n times, which makes the instantiation count quadratic
 * (TS2589 at about 240 operators), and a nested cons list instead of a tuple is itself deeper than the instantiation
 * depth limit. Do not return to an accumulating node or to one unbounded accumulator.
 */
type BoolChainChunk = 16

type BalanceBoolChain<K extends "and" | "or", Items extends readonly unknown[]> = Items extends readonly [
	infer Only extends ScalarExprAst,
]
	? Only
	: BalanceBoolChain<K, PairBoolChain<K, Items>>

type PairBoolChain<
	K extends "and" | "or",
	Items extends readonly unknown[],
	Out extends readonly unknown[] = [],
> = Items extends readonly [infer A, infer B, ...infer T]
	? PairBoolChain<K, T, [...Out, { kind: K; left: A; right: B }]>
	: [...Out, ...Items]

/** Adds one operand; a full chunk is balanced into one node of `Done`. */
type PushBoolOperand<
	K extends "and" | "or",
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	E,
> = Items["length"] extends BoolChainChunk ? [[], [...Done, BalanceBoolChain<K, [...Items, E]>]] : [[...Items, E], Done]

type FinishBoolChain<
	K extends "and" | "or",
	Items extends readonly unknown[],
	Done extends readonly unknown[],
> = Items extends readonly [] ? BalanceBoolChain<K, Done> : BalanceBoolChain<K, [...Done, BalanceBoolChain<K, Items>]>

type ParseAndLoopScalarUntyped<
	Tokens extends ParserMonad,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"and">
		? ParseNotScalarUntyped<SkipToken<Tokens>, Env> extends [
				infer R2 extends ParserMonad,
				infer E1,
				infer Env1 extends ExprParseEnv,
			]
			? E1 extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R2, E1, Env1>
				: PushBoolOperand<"and", Items, Done, E1> extends [
							infer I2 extends readonly unknown[],
							infer D2 extends readonly unknown[],
					  ]
					? ParseAndLoopScalarUntyped<R2, I2, D2, Env1>
					: never
			: never
		: [Tokens, FinishBoolChain<"and", Items, Done>, Env]

type ParseAndScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseNotScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseAndLoopScalarUntyped<R0, [E0], [], Env0>
				: never
		: never

type ParseOrLoopScalarUntyped<
	Tokens extends ParserMonad,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"or">
		? ParseAndScalarUntyped<SkipToken<Tokens>, Env> extends [
				infer R2 extends ParserMonad,
				infer E1,
				infer Env1 extends ExprParseEnv,
			]
			? E1 extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R2, E1, Env1>
				: PushBoolOperand<"or", Items, Done, E1> extends [
							infer I2 extends readonly unknown[],
							infer D2 extends readonly unknown[],
					  ]
					? ParseOrLoopScalarUntyped<R2, I2, D2, Env1>
					: never
			: never
		: [Tokens, FinishBoolChain<"or", Items, Done>, Env]

export type ParseOrScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseAndScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseOrLoopScalarUntyped<R0, [E0], [], Env0>
				: never
		: never

/**
 * The rest of an expression after its first operand, which a caller has parsed already: operators, comparison,
 * `AND`, `OR`. Used to continue after redundant parentheses (parse-expression-primary.ts).
 */
export type ParseOrAfterOperand<Tokens extends ParserMonad, First extends ScalarExprAst, Env extends ExprParseEnv> =
	ParseOtherOpAfterOperand<Tokens, First, Env> extends [
		infer R1 extends ParserMonad,
		infer E1,
		infer Env1 extends ExprParseEnv,
	]
		? E1 extends DbtyperErrorShape
			? [R1, E1, Env1]
			: E1 extends ScalarExprAst
				? ParseAfterAddScalarRelIsInUntyped<R1, E1, Env1> extends [
						infer R2 extends ParserMonad,
						infer E2,
						infer Env2 extends ExprParseEnv,
					]
					? E2 extends DbtyperErrorShape
						? [R2, E2, Env2]
						: E2 extends ScalarExprAst
							? ParseAndLoopScalarUntyped<R2, [E2], [], Env2> extends [
									infer R3 extends ParserMonad,
									infer E3,
									infer Env3 extends ExprParseEnv,
								]
								? E3 extends DbtyperErrorShape
									? [R3, E3, Env3]
									: ParseOrLoopScalarUntyped<R3, [E3], [], Env3>
								: never
							: never
					: never
				: never
		: never
