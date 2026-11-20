import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, TokenKey, TokenString } from "../lexer/sql-lexer.ts"
import type { MaximalIdentChain } from "./resolve-expression.ts"
import type { SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type { ExprParseEnv, ScalarIdentParts, ScalarExprAst } from "./parse-expression-ast.ts"
import type { ParsePgCastSuffixTail } from "./parse-expression-cast.ts"
import type { ParseAddScalarUntyped } from "./parse-expression-predicates.ts"
import type { FinishChain, PushChainOperand } from "./parse-expression-chain.ts"
import type {
	ScalarAstNonNumericForMulHead,
	ParseCallAfterName,
	ParsePostfixArrayIndexTail,
	TryOperandScalarUntyped,
} from "./parse-expression-primary.ts"

/** PGT-30: type names that start a typed literal (`interval '1 day'`, `date '2020-01-01'`). */
export type TypedLiteralName = "interval" | "date" | "timestamp" | "timestamptz" | "time"

type TypedLiteralCast<TypeName extends string, Lit extends string> = {
	kind: "pg_cast"
	expr: { kind: "string"; value: Lit }
	type_parts: readonly [TypeName]
}

/** After a typed literal: the cast, and the arithmetic that follows it. */
export type TypedLiteralTail<
	Tokens extends ParserMonad,
	TypeName extends string,
	Lit extends string,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends ArithOpToken
		? ParseArithTailAfterFirstScalarUntyped<Tokens, TypedLiteralCast<TypeName, Lit>, Env>
		: [Tokens, TypedLiteralCast<TypeName, Lit>, Env]

/** EXPR-2, EXPR-5, EXPR-6: a column reference or a function call as a right operand or unary-minus operand. */
export type TryColumnOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends ParserMonad, infer Parts, infer W extends string]
		? Parts extends ScalarIdentParts
			? PeekToken<Rm> extends TokenKey<"(">
				? ParseCallAfterName<Rm, Parts, Env, false>
				: PeekToken<Rm> extends TokenString<infer Lit extends string>
					? Parts extends readonly [infer TypeName extends TypedLiteralName]
						? [SkipToken<Rm>, TypedLiteralCast<TypeName, Lit>, Env]
						: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
					: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
			: SkipFailedExpressionWithEnv<Rm, FormatError<Errors["UNEXPECTED_TOKEN"], ["*"]>, Env>
		: never

type ParseUnaryScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer Rn extends ParserMonad
			? ParseUnaryScalarUntyped<Rn, Env> extends [
					infer Ru extends ParserMonad,
					infer U,
					infer EnvU extends ExprParseEnv,
				]
				? U extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Ru, U, EnvU>
					: U extends ScalarExprAst
						? [Ru, { kind: "neg"; inner: U }, EnvU]
						: never
				: never
			: never
		: TryOperandScalarUntyped<Tokens, Env> extends [
					infer Tu extends ParserMonad,
					infer Bu,
					infer EnvB extends ExprParseEnv,
			  ]
			? Bu extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<Tu, Bu, EnvB>
				: Bu extends ScalarExprAst
					? ParsePgCastSuffixTail<Tu, Bu, EnvB["db"]> extends [
							infer Tp extends ParserMonad,
							infer Bp extends ScalarExprAst,
						]
						? ParsePostfixArrayIndexTail<Tp, Bp, EnvB>
						: never
					: never
			: never

type ParseMulLoopAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"*" | "/">
		? ParseMulRunScalarUntyped<Tokens, [Acc], [], Env>
		: PeekToken<Tokens> extends TokenKey<"%">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? ParseExpScalarUntyped<R1, Env> extends [
						infer R2 extends ParserMonad,
						infer E1,
						infer Env1 extends ExprParseEnv,
					]
					? E1 extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, E1, Env1>
						: E1 extends ScalarExprAst
							? ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mod"; left: Acc; right: E1 }, Env1>
							: never
					: never
				: never
			: [Tokens, Acc, Env]

/** A run of `*` and `/` (both are `mul` nodes), collected as a chain (parse-expression-chain.ts). */
type ParseMulRunScalarUntyped<
	Tokens extends ParserMonad,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"*" | "/">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseExpScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: PushChainOperand<"mul", Items, Done, E1> extends [
								infer I2 extends readonly unknown[],
								infer D2 extends readonly unknown[],
						  ]
						? ParseMulRunScalarUntyped<R2, I2, D2, Env1>
						: never
				: never
			: never
		: FinishChain<"mul", Items, Done> extends infer N extends ScalarExprAst
			? ParseMulLoopAfterFirstScalarUntyped<Tokens, N, Env>
			: never

type ParseExpLoop<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"^">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseUnaryScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? ParseExpLoop<R2, { kind: "exp"; left: Acc; right: E1 }, Env1>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

type ParseExpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseUnaryScalarUntyped<Tokens, Env> extends [
		infer R0 extends ParserMonad,
		infer E0,
		infer Env0 extends ExprParseEnv,
	]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseExpLoop<R0, E0, Env0>
				: never
		: never

/** An operand of `+` / `-` (EXPR-5): the unary operand, then `^`, then `* / %`; the `^` loop runs after the operand, not around it (#180: one level less of instantiation depth per nesting). */
export type ParseMulScalarUntypedEntry<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseUnaryScalarUntyped<Tokens, Env> extends [
		infer Ru extends ParserMonad,
		infer Eu,
		infer EnvU extends ExprParseEnv,
	]
		? Eu extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<Ru, Eu, EnvU>
			: Eu extends ScalarExprAst
				? ParseMulAfterUnary<Ru, Eu, EnvU>
				: never
		: never

type ParseMulAfterUnary<Tokens extends ParserMonad, First extends ScalarExprAst, Env extends ExprParseEnv> =
	ParseExpLoop<Tokens, First, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<Env0["db"], E0> extends true
					? PeekToken<R0> extends infer P
						? P extends
								| TokenKey<"+">
								| TokenKey<"-">
								| TokenKey<"*">
								| TokenKey<"/">
								| TokenKey<"%">
								| TokenKey<"^">
							? SkipFailedExpressionWithEnv<
									R0,
									FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>,
									Env0
								>
							: [R0, E0, Env0]
						: never
					: ParseMulLoopAfterFirstScalarUntyped<R0, E0, Env0>
				: never
		: never

type IsCustomOperatorString<S extends string> = S extends ""
	? false
	: S extends `${infer C}${infer Rest}`
		? C extends "+" | "-" | "*" | "/" | "<" | ">" | "=" | "~" | "!" | "@" | "#" | "%" | "^" | "&" | "|" | "`" | "?"
			? Rest extends ""
				? true
				: IsCustomOperatorString<Rest>
			: false
		: false

type IsOtherOp<T> =
	T extends TokenKey<infer K extends string>
		? IsCustomOperatorString<K> extends true
			? K extends
					| "+"
					| "-"
					| "*"
					| "/"
					| "%"
					| "^"
					| "="
					| "<>"
					| "!="
					| "<="
					| ">="
					| "<"
					| ">"
					| "~"
					| "~*"
					| "!~"
					| "!~*"
				? false
				: true
			: false
		: false

type ParseOtherOpLoop<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"||">
		? ParseConcatRunScalarUntyped<Tokens, [Acc], [], Env>
		: PeekToken<Tokens> extends infer P
			? IsOtherOp<P> extends true
				? SkipToken<Tokens> extends infer R1 extends ParserMonad
					? P extends TokenKey<infer Op>
						? ParseAddScalarUntyped<R1, Env> extends [
								infer R2 extends ParserMonad,
								infer Rhs,
								infer Env2 extends ExprParseEnv,
							]
							? Rhs extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<R2, Rhs, Env2>
								: Rhs extends ScalarExprAst
									? ParseOtherOpLoop<R2, { kind: "custom_op"; op: Op; left: Acc; right: Rhs }, Env2>
									: never
							: never
						: never
					: never
				: PeekToken<Tokens> extends TokenIdent<"operator">
					? SkipToken<Tokens> extends infer R1 extends ParserMonad
						? PeekToken<R1> extends TokenKey<"(">
							? SkipToken<R1> extends infer R2 extends ParserMonad
								? PeekToken<R2> extends TokenKey<infer Op>
									? SkipToken<R2> extends infer R3 extends ParserMonad
										? PeekToken<R3> extends TokenKey<")">
											? SkipToken<R3> extends infer R4 extends ParserMonad
												? ParseAddScalarUntyped<R4, Env> extends [
														infer R5 extends ParserMonad,
														infer Rhs,
														infer Env5 extends ExprParseEnv,
													]
													? Rhs extends DbtyperErrorShape
														? SkipFailedExpressionWithEnv<R5, Rhs, Env5>
														: Rhs extends ScalarExprAst
															? ParseOtherOpLoop<
																	R5,
																	{
																		kind: "custom_op"
																		op: Op
																		left: Acc
																		right: Rhs
																	},
																	Env5
																>
															: never
													: never
												: never
											: SkipFailedExpressionWithEnv<
													R3,
													FormatError<
														Errors["EXPECTED_CLOSE_PAREN_AFTER_OPERATOR_OPEN_PAREN"],
														[]
													>,
													Env
												>
										: never
									: SkipFailedExpressionWithEnv<
											R2,
											FormatError<Errors["EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN"], []>,
											Env
										>
								: never
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OPERATOR"], []>,
									Env
								>
						: never
					: [Tokens, Acc, Env]
			: [Tokens, Acc, Env]

/** A run of `||`, collected as a chain (parse-expression-chain.ts). */
type ParseConcatRunScalarUntyped<
	Tokens extends ParserMonad,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"||">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseAddScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer Rhs,
					infer Env2 extends ExprParseEnv,
				]
				? Rhs extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, Rhs, Env2>
					: Rhs extends ScalarExprAst
						? PushChainOperand<"concat", Items, Done, Rhs> extends [
								infer I2 extends readonly unknown[],
								infer D2 extends readonly unknown[],
							]
							? ParseConcatRunScalarUntyped<R2, I2, D2, Env2>
							: never
						: never
				: never
			: never
		: FinishChain<"concat", Items, Done> extends infer N extends ScalarExprAst
			? ParseOtherOpLoop<Tokens, N, Env>
			: never

/** The operators above `AND` after an operand that is already parsed: `^ * / % + -`, then `||` and custom operators. */
export type ParseOtherOpAfterOperand<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	ParseArithTailAfterFirstScalarUntyped<Tokens, Acc, Env> extends [
		infer R1 extends ParserMonad,
		infer E1,
		infer Env1 extends ExprParseEnv,
	]
		? E1 extends DbtyperErrorShape
			? [R1, E1, Env1]
			: E1 extends ScalarExprAst
				? ParseOtherOpLoop<R1, E1, Env1>
				: never
		: never

export type ParseOtherOpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseAddScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseOtherOpLoop<R0, E0, Env0>
				: never
		: never

/** A run of `+`, collected as a chain (parse-expression-chain.ts); `-` ends it. */
type ParseAddRunScalarUntyped<
	Tokens extends ParserMonad,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	Env extends ExprParseEnv,
	Steps extends readonly unknown[],
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseMulScalarUntypedEntry<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? PushChainOperand<"add", Items, Done, E1> extends [
								infer I2 extends readonly unknown[],
								infer D2 extends readonly unknown[],
							]
							? ParseAddRunScalarUntyped<R2, I2, D2, Env1, Steps>
							: never
						: never
				: never
			: never
		: FinishChain<"add", Items, Done> extends infer N extends ScalarExprAst
			? ParseAddLoopAfterFirstScalarUntyped<Tokens, N, Env, [...Steps, 0]>
			: never

type ParseAddLoopAfterMinusScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
	Steps extends readonly unknown[],
> =
	PeekToken<Tokens> extends TokenKey<"-">
		? Steps extends AddSubStepsAtLimit
			? SkipFailedExpressionWithEnv<
					Tokens,
					FormatError<Errors["EXPRESSION_CHAIN_TOO_LONG"], [`${AddSubStepLimit}`]>,
					Env
				>
			: SkipToken<Tokens> extends infer R3 extends ParserMonad
				? ParseMulScalarUntypedEntry<R3, Env> extends [
						infer R4 extends ParserMonad,
						infer E2,
						infer Env2 extends ExprParseEnv,
					]
					? E2 extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R4, E2, Env2>
						: E2 extends ScalarExprAst
							? ParseAddLoopAfterFirstScalarUntyped<
									R4,
									MergeScalarAstAddSub<"sub", Acc, E2>,
									Env2,
									[...Steps, 0]
								>
							: never
					: never
				: never
		: never

type MergeScalarAstAddSub<Op extends "add" | "sub", L extends ScalarExprAst, R extends ScalarExprAst> = Op extends "add"
	? { kind: "add"; left: L; right: R }
	: { kind: "sub"; left: L; right: R }

/**
 * `-` is not associative, so a chain of `-` (and `+` runs between them) stays left-nested: about 25 levels fit
 * (#174). `Steps` counts the `-` operators and the `+` runs; past {@link AddSubStepLimit} the parser says so instead of
 * running into TS2589. A `+` run of up to 8 operands counts as one step, which is generous for mixed chains.
 */
type AddSubStepLimit = 20

/** At least {@link AddSubStepLimit} elements. */
type AddSubStepsAtLimit = readonly [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...0[]]

export type ParseAddLoopAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
	Steps extends readonly unknown[] = [],
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? ParseAddRunScalarUntyped<Tokens, [Acc], [], Env, Steps>
		: PeekToken<Tokens> extends TokenKey<"-">
			? ParseAddLoopAfterMinusScalarUntyped<Tokens, Acc, Env, Steps>
			: [Tokens, Acc, Env]

export type ArithOpToken = TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*"> | TokenKey<"/"> | TokenKey<"%"> | TokenKey<"^">

/** After a leftmost operand: `^`, then `* / %`, then `+ -` (EXPR-5 precedence). */
export type ParseArithTailAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	ParseExpLoop<Tokens, Acc, Env> extends [infer R1 extends ParserMonad, infer E1, infer Env1 extends ExprParseEnv]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E1, Env1>
			: E1 extends ScalarExprAst
				? ParseMulLoopAfterFirstScalarUntyped<R1, E1, Env1> extends [
						infer R2 extends ParserMonad,
						infer E2,
						infer Env2 extends ExprParseEnv,
					]
					? E2 extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, E2, Env2>
						: E2 extends ScalarExprAst
							? ParseAddLoopAfterFirstScalarUntyped<R2, E2, Env2>
							: never
					: never
				: never
		: never
