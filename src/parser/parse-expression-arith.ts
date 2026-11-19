import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, TokenKey, TokenString } from "../lexer/sql-lexer.ts"
import type { MaximalIdentChain } from "./resolve-expression.ts"
import type { SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type { ExprParseEnv, ScalarIdentParts, ScalarExprAst } from "./parse-expression-ast.ts"
import type { ParsePgCastSuffixTail } from "./parse-expression-cast.ts"
import type { ParseAddScalarUntyped } from "./parse-expression-predicates.ts"
import type {
	ScalarAstNonNumericForMulHead,
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

/** EXPR-2, EXPR-5, EXPR-6: a column reference as a right operand or unary-minus operand. */
export type TryColumnOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends ParserMonad, infer Parts, infer W extends string]
		? Parts extends ScalarIdentParts
			? PeekToken<Rm> extends TokenKey<"(">
				? SkipFailedExpressionWithEnv<Rm, FormatError<Errors["UNEXPECTED_TOKEN"], ["("]>, Env>
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
					? ParsePgCastSuffixTail<Tu, Bu> extends [
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
	PeekToken<Tokens> extends TokenKey<"*" | "/" | "%">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseExpScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? PeekToken<Tokens> extends TokenKey<"%">
							? ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mod"; left: Acc; right: E1 }, Env1>
							: ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mul"; left: Acc; right: E1 }, Env1>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

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

export type ParseMulScalarUntypedEntry<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseExpScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
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
	PeekToken<Tokens> extends infer P
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
																{ kind: "custom_op"; op: Op; left: Acc; right: Rhs },
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

export type ParseOtherOpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseAddScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseOtherOpLoop<R0, E0, Env0>
				: never
		: never

type ParseAddLoopAfterPlusScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
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
						? ParseAddLoopAfterFirstScalarUntyped<R2, MergeScalarAstAddSub<"add", Acc, E1>, Env1>
						: never
				: never
			: never
		: never

type ParseAddLoopAfterMinusScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer R3 extends ParserMonad
			? ParseMulScalarUntypedEntry<R3, Env> extends [
					infer R4 extends ParserMonad,
					infer E2,
					infer Env2 extends ExprParseEnv,
				]
				? E2 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, E2, Env2>
					: E2 extends ScalarExprAst
						? ParseAddLoopAfterFirstScalarUntyped<R4, MergeScalarAstAddSub<"sub", Acc, E2>, Env2>
						: never
				: never
			: never
		: never

type MergeScalarAstAddSub<Op extends "add" | "sub", L extends ScalarExprAst, R extends ScalarExprAst> = Op extends "add"
	? { kind: "add"; left: L; right: R }
	: { kind: "sub"; left: L; right: R }

export type ParseAddLoopAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? ParseAddLoopAfterPlusScalarUntyped<Tokens, Acc, Env>
		: PeekToken<Tokens> extends TokenKey<"-">
			? ParseAddLoopAfterMinusScalarUntyped<Tokens, Acc, Env>
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
