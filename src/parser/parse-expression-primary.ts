import type { JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { Dec, ParseNumber } from "../core/type-utils.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type {
	AsIdent,
	TokenIdent,
	TokenIndexedParam,
	TokenKey,
	TokenNumber,
	TokenParam,
	TokenString,
	TokenType,
} from "../lexer/sql-lexer.ts"
import type { ParseCallArgs, ParseOptionalOverClause } from "./parse-function-call.ts"
import type { ParseParenScalarSelect } from "./parse-select-subquery.ts"
import type { CastGivesText, SqlCastTypeNorm } from "./resolve-cast.ts"
import type { MaximalIdentChain } from "./resolve-expression.ts"
import type { SkipBracketedUntil, SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type { ExprParseEnv, ScalarIdentParts, ScalarExprAst } from "./parse-expression-ast.ts"
import type { ParseCastKeywordOperand, ParsePgCastSuffixTail } from "./parse-expression-cast.ts"
import type { ParseCaseAfterCaseKw } from "./parse-expression-predicates.ts"
import type { ParseOrScalarUntyped } from "./parse-expression-bool.ts"
import type {
	TypedLiteralName,
	TypedLiteralTail,
	TryColumnOperandScalarUntyped,
	ParseMulScalarUntypedEntry,
	ParseAddLoopAfterFirstScalarUntyped,
	ArithOpToken,
	ParseArithTailAfterFirstScalarUntyped,
} from "./parse-expression-arith.ts"

export type ScalarAstNonNumericForMulHead<Db, E extends ScalarExprAst> = E extends { kind: "string" }
	? true
	: E extends { kind: "true" }
		? true
		: E extends { kind: "false" }
			? true
			: E extends { kind: "sql_null" }
				? true
				: E extends { kind: "neg"; inner: infer I extends ScalarExprAst }
					? ScalarAstNonNumericForMulHead<Db, I>
					: E extends {
								kind: "pg_cast"
								expr: infer Ic extends ScalarExprAst
								type_parts: infer Pc extends readonly string[]
						  }
						? SqlCastTypeNorm<Pc> extends infer Nc extends string
							? CastGivesText<Db, Nc> extends true
								? true
								: ScalarAstNonNumericForMulHead<Db, Ic>
							: ScalarAstNonNumericForMulHead<Db, Ic>
						: E extends {
									kind: "sql_cast"
									expr: infer Ics extends ScalarExprAst
									type_parts: infer Pcs extends readonly string[]
							  }
							? SqlCastTypeNorm<Pcs> extends infer Ncs extends string
								? CastGivesText<Db, Ncs> extends true
									? true
									: ScalarAstNonNumericForMulHead<Db, Ics>
								: ScalarAstNonNumericForMulHead<Db, Ics>
							: E extends { kind: "exists_subquery" }
								? true
								: E extends { kind: "in_subquery" }
									? true
									: E extends { kind: "array_ctor" }
										? true
										: E extends { kind: "array_index" }
											? true
											: false

/** Comma-separated contents of `ARRAY[ … ]`. */
type ParseArrayCtorElementsAccum<
	Tokens extends ParserMonad,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"]">
		? [SkipToken<Tokens>, Acc, Env]
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer R1 extends ParserMonad,
					infer Ele,
					infer Env1 extends ExprParseEnv,
			  ]
			? Ele extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R1, Ele, Env1>
				: Ele extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<"]">
						? [SkipToken<R1>, readonly [...Acc, Ele], Env1]
						: PeekToken<R1> extends TokenKey<",">
							? ParseArrayCtorElementsAccum<SkipToken<R1>, readonly [...Acc, Ele], Env1>
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_BRACKET_IN_ARRAY_CONSTRUCTOR"], []>,
									Env1
								>
					: never
			: never

type ParseArrayCtorAfterArrayKw<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"]">
				? [SkipToken<R1>, { kind: "array_ctor"; elements: readonly [] }, Env]
				: ParseArrayCtorElementsAccum<R1, readonly [], Env> extends [
							infer R2 extends ParserMonad,
							infer Out,
							infer Env2 extends ExprParseEnv,
					  ]
					? Out extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, Out, Env2>
						: Out extends readonly ScalarExprAst[]
							? [R2, { kind: "array_ctor"; elements: Out }, Env2]
							: never
					: never
			: never
		: never

export type ParsePostfixArrayIndexTail<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer Ri extends ParserMonad
			? ParseOrScalarUntyped<Ri, Env> extends [
					infer Rj extends ParserMonad,
					infer Idx,
					infer EnvIdx extends ExprParseEnv,
				]
				? Idx extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rj, Idx, EnvIdx>
					: Idx extends ScalarExprAst
						? PeekToken<Rj> extends TokenKey<"]">
							? ParsePostfixArrayIndexTail<
									SkipToken<Rj>,
									{ kind: "array_index"; base: Acc; index: Idx },
									EnvIdx
								>
							: SkipFailedExpressionWithEnv<
									Rj,
									FormatError<Errors["EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT"], []>,
									EnvIdx
								>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

type TryParenOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipToken<Tokens> extends infer Ri extends ParserMonad
			? PeekToken<Ri> extends TokenKey<"select">
				? ParseParenScalarSelect<Ri, Env["db"], Env["params"], Env["outerScope"]> extends [
						infer Rk extends ParserMonad,
						infer Sub,
					]
					? Sub extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Rk, Sub, Env>
						: Sub extends JsqlSelectStatementResult
							? [Rk, { kind: "scalar_subquery"; sel: Sub }, Env]
							: never
					: never
				: PeekToken<Ri> extends TokenKey<"with">
					? ParseParenScalarSelect<Ri, Env["db"], Env["params"], Env["outerScope"]> extends [
							infer Rw extends ParserMonad,
							infer Subw,
						]
						? Subw extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<Rw, Subw, Env>
							: Subw extends JsqlSelectStatementResult
								? [Rw, { kind: "scalar_subquery"; sel: Subw }, Env]
								: never
						: never
					: ParseOrScalarUntyped<Ri, Env> extends [
								infer Rj extends ParserMonad,
								infer Ej,
								infer EnvJ extends ExprParseEnv,
						  ]
						? Ej extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<Rj, Ej, EnvJ>
							: PeekToken<Rj> extends infer TokCl
								? SkipToken<Rj> extends infer Rk2 extends ParserMonad
									? TokCl extends TokenKey<")">
										? [Rk2, Ej, EnvJ]
										: SkipFailedExpressionWithEnv<
												Rk2,
												FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>,
												EnvJ
											>
									: never
								: never
						: never
			: never
		: never

export type TryOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? ParseCastKeywordOperand<Tokens, Env>
		: PeekToken<Tokens> extends TokenKey<"case">
			? ParseCaseAfterCaseKw<SkipToken<Tokens>, Env>
			: PeekToken<Tokens> extends TokenKey<"array">
				? SkipToken<Tokens> extends infer RarrKw extends ParserMonad
					? ParseArrayCtorAfterArrayKw<RarrKw, Env> extends [
							infer Rarr extends ParserMonad,
							infer ArrOut,
							infer EnvArr extends ExprParseEnv,
						]
						? ArrOut extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<Rarr, ArrOut, EnvArr>
							: ArrOut extends ScalarExprAst
								? [Rarr, ArrOut, EnvArr]
								: never
						: never
					: never
				: PeekToken<Tokens> extends TokenKey<"(">
					? TryParenOperandScalarUntyped<Tokens, Env>
					: PeekToken<Tokens> extends TokenKey<"current_timestamp" | "current_date" | "current_time">
						? PeekToken<Tokens> extends TokenKey<infer Word extends string>
							? [SkipToken<Tokens>, { kind: "function_call"; name: Word; args: readonly [] }, Env]
							: never
						: PeekToken<Tokens> extends TokenKey<"true">
							? [SkipToken<Tokens>, { kind: "true" }, Env]
							: PeekToken<Tokens> extends TokenKey<"false">
								? [SkipToken<Tokens>, { kind: "false" }, Env]
								: PeekToken<Tokens> extends TokenKey<"null">
									? [SkipToken<Tokens>, { kind: "sql_null" }, Env]
									: PeekToken<Tokens> extends TokenString<infer Str>
										? [
												SkipToken<Tokens>,
												PeekToken<Tokens> extends { blob: true }
													? { kind: "string"; value: Str; blob: true }
													: { kind: "string"; value: Str },
												Env,
											]
										: PeekToken<Tokens> extends TokenNumber<infer Raw>
											? [SkipToken<Tokens>, { kind: "number"; raw: Raw }, Env]
											: PeekToken<Tokens> extends TokenParam<infer P>
												? [SkipToken<Tokens>, { kind: "param"; name: P }, Env]
												: PeekToken<Tokens> extends TokenIndexedParam<infer Index>
													? [
															SkipToken<Tokens>,
															{
																kind: "positional-param"
																index: Dec<ParseNumber<Index>>
															},
															Env,
														]
													: AsIdent<PeekToken<Tokens>> extends TokenIdent<string>
														? TryColumnOperandScalarUntyped<Tokens, Env>
														: PeekToken<Tokens> extends TokenType<infer _Kind, infer Value>
															? SkipFailedExpressionWithEnv<
																	Tokens,
																	FormatError<Errors["UNEXPECTED_TOKEN"], [Value]>,
																	Env
																>
															: never
export type ParseScalarExprUntypedFromIdent<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends ParserMonad, infer Parts, infer W extends string]
		? Parts extends readonly ["__ats__", infer Al extends string]
			? PeekToken<Rm> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [infer After extends ParserMonad, infer Rs]
					? Rs extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<After, FormatError<Errors["UNBALANCED_PARENTHESES"], []>, Env>
						: SkipFailedExpressionWithEnv<
								SkipToken<After>,
								FormatError<Errors["UNSUPPORTED_PARENTHESIZED_EXPRESSION"], []>,
								Env
							>
					: never
				: [Rm, { kind: "alias_table_star"; alias: Al }, Env]
			: Parts extends readonly ["__qts__", infer Sch extends string, infer Tab extends string]
				? PeekToken<Rm> extends TokenKey<"(">
					? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [
							infer After extends ParserMonad,
							infer Rs,
						]
						? Rs extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<After, FormatError<Errors["UNBALANCED_PARENTHESES"], []>, Env>
							: SkipFailedExpressionWithEnv<
									SkipToken<After>,
									FormatError<Errors["UNSUPPORTED_PARENTHESIZED_EXPRESSION"], []>,
									Env
								>
						: never
					: [Rm, { kind: "qualified_table_star"; schema: Sch; table: Tab }, Env]
				: Parts extends ScalarIdentParts
					? PeekToken<Rm> extends TokenKey<"(">
						? ParseCallArgs<SkipToken<Rm>, Parts, Env> extends [
								infer After extends ParserMonad,
								infer Args,
								infer EnvAfter extends ExprParseEnv,
							]
							? Args extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<After, Args, EnvAfter>
								: Args extends readonly (ScalarExprAst | { kind: "star" })[]
									? Parts extends readonly [infer FnName extends string]
										? ParseOptionalOverClause<After, FnName, Args, EnvAfter> extends [
												infer Rcall extends ParserMonad,
												infer Call,
												infer EnvCall extends ExprParseEnv,
											]
											? Call extends ScalarExprAst
												? PeekToken<Rcall> extends ArithOpToken
													? ParseArithTailAfterFirstScalarUntyped<Rcall, Call, EnvCall> // `now() - interval '1 day'`, `count(*) - 1`
													: [Rcall, Call, EnvCall]
												: [Rcall, Call, EnvCall]
											: never
										: SkipFailedExpressionWithEnv<
												After,
												FormatError<Errors["QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED"], []>,
												EnvAfter
											>
									: never
							: never
						: PeekToken<Rm> extends infer Pa
							? Pa extends TokenString<infer Lit extends string>
								? Parts extends readonly [infer TypeName extends TypedLiteralName]
									? TypedLiteralTail<SkipToken<Rm>, TypeName, Lit, Env>
									: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
								: Pa extends TokenKey<"::">
									? ParsePgCastSuffixTail<Rm, { kind: "col"; parts: Parts; written: W }> extends [
											infer Rcast extends ParserMonad,
											infer Casted extends ScalarExprAst,
										]
										? PeekToken<Rcast> extends ArithOpToken
											? ParseArithTailAfterFirstScalarUntyped<Rcast, Casted, Env>
											: [Rcast, Casted, Env]
										: never
									: Pa extends ArithOpToken
										? ParseArithTailAfterFirstScalarUntyped<
												Rm,
												{ kind: "col"; parts: Parts; written: W },
												Env
											>
										: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
							: never
					: never
		: never

export type ParseScalarExprUntypedNonIdent<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseMulScalarUntypedEntry<Tokens, Env> extends [
		infer R0 extends ParserMonad,
		infer E0,
		infer Env0 extends ExprParseEnv,
	]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<Env0["db"], E0> extends true
					? PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? SkipFailedExpressionWithEnv<
									R0,
									FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>,
									Env0
								>
							: [R0, E0, Env0]
						: never
					: ParseAddLoopAfterFirstScalarUntyped<R0, E0, Env0>
				: never
		: never
