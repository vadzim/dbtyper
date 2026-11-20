import type { JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { Dec, MaxPositionalParams, OverParamLimit, ParseNumber } from "../core/type-utils.ts"
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
import type { ParseOrAfterOperand, ParseOrScalarUntyped } from "./parse-expression-bool.ts"
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
		: ParseCollateTail<Tokens, Acc, Env>

/**
 * `<expr> COLLATE <name>` (name: identifier or quoted identifier): a postfix that keeps the operand's type, so it is
 * read and dropped. May repeat (`x COLLATE a COLLATE b`).
 */
type ParseCollateTail<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenIdent<"collate">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<string>
				? ParseCollateTail<SkipToken<R1>, Acc, Env>
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_COLLATION_NAME"], []>, Env>
			: never
		: [Tokens, Acc, Env]

/**
 * How many parentheses, function calls and CASE expressions may nest in each other before the parser gives up with
 * a dbtyper error instead of TS2589 (#174, #180; spec: at least 8). Every level is a few levels of TypeScript's
 * instantiation depth (the expression parser, then the resolver); measured (TS 7.0.2, 2026-11-20): 10 levels of
 * `c1 + (…)` fit in a scalar subquery, the deepest common context, and 12 in a plain select list.
 * Redundant parentheses `((x))` are read in one step and do not count.
 */
type NestingLimit = 8

/** EXPRESSION_NESTED_TOO_DEEP with the limit. */
type NestedTooDeepError = FormatError<Errors["EXPRESSION_NESTED_TOO_DEEP"], [`${NestingLimit}`]>

/** `Env` one nesting level deeper (see {@link NestingLimit}). */
type NestedEnv<Env extends ExprParseEnv> = Env extends { noPostfixNot: true }
	? { db: Env["db"]; params: Env["params"]; outerScope: Env["outerScope"]; noPostfixNot: true; depth: NextDepth<Env> }
	: { db: Env["db"]; params: Env["params"]; outerScope: Env["outerScope"]; depth: NextDepth<Env> }

type NextDepth<Env extends ExprParseEnv> = Env extends { depth: infer D extends readonly unknown[] } ? [...D, 0] : [0]

/** `true` when `Env` is {@link NestingLimit} levels deep. */
type EnvDepthIsAtLimit<Env extends ExprParseEnv> = Env extends { depth: infer D extends readonly unknown[] }
	? D["length"] extends NestingLimit
		? true
		: false
	: false

/** `(` was skipped (`Ri` follows it, not `SELECT`/`WITH`): the expression, then `)`. */
type ParseParenExprPlain<Ri extends ParserMonad, Env extends ExprParseEnv> =
	EnvDepthIsAtLimit<Env> extends true
		? SkipFailedExpressionWithEnv<Ri, NestedTooDeepError, Env>
		: ParseOrScalarUntyped<Ri, NestedEnv<Env>> extends [infer Rj extends ParserMonad, infer Ej, infer _EnvJ]
			? Ej extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<Rj, Ej, Env>
				: PeekToken<Rj> extends infer TokCl
					? SkipToken<Rj> extends infer Rk2 extends ParserMonad
						? TokCl extends TokenKey<")">
							? [Rk2, Ej, Env]
							: SkipFailedExpressionWithEnv<Rk2, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>, Env>
						: never
					: never
			: never

/** After a parenthesised group inside redundant parentheses: its postfixes (`::`, `[]`, COLLATE), then the rest of the expression. */
type ContinueAfterGroup<Tokens extends ParserMonad, Group extends ScalarExprAst, Env extends ExprParseEnv> =
	ParsePgCastSuffixTail<Tokens, Group, Env["db"]> extends [infer R1 extends ParserMonad, infer G1]
		? G1 extends ScalarExprAst
			? ParsePostfixArrayIndexTail<R1, G1, Env> extends [
					infer R2 extends ParserMonad,
					infer G2,
					infer Env2 extends ExprParseEnv,
				]
				? G2 extends ScalarExprAst
					? ParseOrAfterOperand<R2, G2, Env2>
					: [R2, G2, Env2]
				: never
			: [R1, G1, Env]
		: never

/**
 * Closes the parentheses that {@link ParseParenCollapsed} opened. `Pending` has one element for each open parenthesis
 * that is not closed yet; `Inner` is the expression of the innermost one.
 */
type CloseCollapsedParens<
	Tokens extends ParserMonad,
	Inner extends ScalarExprAst,
	Pending extends readonly unknown[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<")">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Pending extends readonly [unknown, ...infer Rest]
				? Rest extends readonly []
					? [R1, Inner, Env]
					: PeekToken<R1> extends TokenKey<")">
						? CloseCollapsedParens<R1, Inner, Rest, Env>
						: ContinueAfterGroup<R1, Inner, Env> extends [
									infer R2 extends ParserMonad,
									infer E2,
									infer EnvC extends ExprParseEnv,
							  ]
							? E2 extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<R2, E2, EnvC>
								: E2 extends ScalarExprAst
									? CloseCollapsedParens<R2, E2, Rest, Env>
									: never
							: never
				: never
			: never
		: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>, Env>

/**
 * `((( expr )))`: the opening parentheses are counted in a loop and the expression is parsed once, so redundant
 * parentheses do not nest (nesting costs about 10 instantiation levels each; 9 gave TS2589, #174). Closing them is a
 * loop too ({@link CloseCollapsedParens}), which also reads what follows a group inside another (`((a) + b)`).
 * The monad is not copied, so there is no way back: every case is handled in the one pass.
 */
type ParseParenCollapsed<Tokens extends ParserMonad, Opened extends readonly unknown[], Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseParenCollapsed<SkipToken<Tokens>, [...Opened, 0], Env>
		: PeekToken<Tokens> extends TokenKey<"select" | "with">
			? ParseParenScalarSelect<Tokens, Env["db"], Env["params"], Env["outerScope"]> extends [
					infer Rk extends ParserMonad,
					infer Sub,
				]
				? Sub extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rk, Sub, Env>
					: Sub extends JsqlSelectStatementResult
						? Opened extends readonly [unknown, ...infer Rest]
							? ContinueAfterGroup<Rk, { kind: "scalar_subquery"; sel: Sub }, Env> extends [
									infer R2 extends ParserMonad,
									infer E2,
									infer EnvC extends ExprParseEnv,
								]
								? E2 extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<R2, E2, EnvC>
									: E2 extends ScalarExprAst
										? CloseCollapsedParens<R2, E2, Rest, Env>
										: never
								: never
							: never
						: never
				: never
			: ParseOrScalarUntyped<Tokens, Env> extends [
						infer Rj extends ParserMonad,
						infer Ej,
						infer EnvJ extends ExprParseEnv,
				  ]
				? Ej extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rj, Ej, EnvJ>
					: Ej extends ScalarExprAst
						? CloseCollapsedParens<Rj, Ej, Opened, Env>
						: never
				: never

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
					: PeekToken<Ri> extends TokenKey<"(">
						? ParseParenCollapsed<Ri, [0], Env>
						: ParseParenExprPlain<Ri, Env>
			: never
		: never

export type TryOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? ParseCastKeywordOperand<Tokens, Env>
		: PeekToken<Tokens> extends TokenKey<"case">
			? EnvDepthIsAtLimit<Env> extends true
				? SkipFailedExpressionWithEnv<SkipToken<Tokens>, NestedTooDeepError, Env>
				: ParseCaseAfterCaseKw<SkipToken<Tokens>, NestedEnv<Env>> extends [
							infer Rcase extends ParserMonad,
							infer Case,
							infer _EnvCase extends ExprParseEnv,
					  ]
					? [Rcase, Case, Env]
					: never
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
													? OverParamLimit<ParseNumber<Index>> extends true
														? // #167, #180: `$200`, `?250` are past the most positional parameters a statement may have
															SkipFailedExpressionWithEnv<
																Tokens,
																FormatError<
																	Errors["TOO_MANY_PARAMETERS"],
																	[MaxPositionalParams]
																>,
																Env
															>
														: [
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
/**
 * A function call after its name (`Rm` is at `(`): the arguments one nesting level deeper ({@link NestingLimit}),
 * FILTER / OVER, then `::` and COLLATE. With `ArithTail` the arithmetic after it too (the leftmost operand of an
 * expression); as the right operand of an operator (`x + f(y)`, `TryColumnOperandScalarUntyped`) it stops there, and
 * that operator's loop goes on (#180: a call was error 1007 there).
 */
export type ParseCallAfterName<
	Rm extends ParserMonad,
	Parts extends ScalarIdentParts,
	Env extends ExprParseEnv,
	ArithTail extends boolean,
> =
	EnvDepthIsAtLimit<Env> extends true
		? SkipFailedExpressionWithEnv<SkipToken<Rm>, NestedTooDeepError, Env>
		: ParseCallArgs<SkipToken<Rm>, Parts, NestedEnv<Env>> extends [
					infer After extends ParserMonad,
					infer Args,
					infer _EnvArgs extends ExprParseEnv,
			  ]
			? Args extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<After, Args, Env>
				: Args extends readonly (ScalarExprAst | { kind: "star" })[]
					? Parts extends readonly [infer FnName extends string]
						? ParseOptionalOverClause<After, FnName, Args, Env> extends [
								infer Rcall extends ParserMonad,
								infer Call,
								infer EnvCall extends ExprParseEnv,
							]
							? Call extends ScalarExprAst
								? PeekToken<Rcall> extends TokenKey<"::"> | TokenIdent<"collate">
									? ParsePgCastSuffixTail<Rcall, Call, Env["db"]> extends [
											infer Rcs extends ParserMonad,
											infer Casted extends ScalarExprAst,
										]
										? ParseCollateTail<Rcs, Casted, EnvCall> extends [
												infer Rcc extends ParserMonad,
												infer CallC,
												infer EnvCc extends ExprParseEnv,
											]
											? CallC extends ScalarExprAst
												? [ArithTail, PeekToken<Rcc>] extends [true, ArithOpToken]
													? ParseArithTailAfterFirstScalarUntyped<Rcc, CallC, EnvCc>
													: [Rcc, CallC, EnvCc]
												: [Rcc, CallC, EnvCc]
											: never
										: never
									: [ArithTail, PeekToken<Rcall>] extends [true, ArithOpToken]
										? ParseArithTailAfterFirstScalarUntyped<Rcall, Call, EnvCall> // `now() - interval '1 day'`, `count(*) - 1`
										: [Rcall, Call, EnvCall]
								: [Rcall, Call, EnvCall]
							: never
						: SkipFailedExpressionWithEnv<
								After,
								FormatError<Errors["QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED"], []>,
								Env
							>
					: never
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
						? ParseCallAfterName<Rm, Parts, Env, true>
						: PeekToken<Rm> extends infer Pa
							? Pa extends TokenString<infer Lit extends string>
								? Parts extends readonly [infer TypeName extends TypedLiteralName]
									? TypedLiteralTail<SkipToken<Rm>, TypeName, Lit, Env>
									: [Rm, { kind: "col"; parts: Parts; written: W }, Env]
								: Pa extends TokenKey<"::">
									? ParsePgCastSuffixTail<
											Rm,
											{ kind: "col"; parts: Parts; written: W },
											Env["db"]
										> extends [infer Rcast extends ParserMonad, infer Casted extends ScalarExprAst]
										? PeekToken<Rcast> extends ArithOpToken
											? ParseArithTailAfterFirstScalarUntyped<Rcast, Casted, Env>
											: PeekToken<Rcast> extends TokenIdent<"collate"> // `s::text collate "C"`
												? ParseCollateTail<Rcast, Casted, Env> extends [
														infer Rcc extends ParserMonad,
														infer CastC,
														infer EnvCc extends ExprParseEnv,
													]
													? CastC extends ScalarExprAst
														? PeekToken<Rcc> extends ArithOpToken
															? ParseArithTailAfterFirstScalarUntyped<Rcc, CastC, EnvCc>
															: [Rcc, CastC, EnvCc]
														: [Rcc, CastC, EnvCc]
													: never
												: [Rcast, Casted, Env]
										: never
									: Pa extends ArithOpToken
										? ParseArithTailAfterFirstScalarUntyped<
												Rm,
												{ kind: "col"; parts: Parts; written: W },
												Env
											>
										: Pa extends TokenIdent<"collate">
											? ParseCollateTail<
													Rm,
													{ kind: "col"; parts: Parts; written: W },
													Env
												> extends [
													infer Rcl extends ParserMonad,
													infer Col,
													infer EnvCl extends ExprParseEnv,
												]
												? Col extends ScalarExprAst
													? PeekToken<Rcl> extends ArithOpToken
														? ParseArithTailAfterFirstScalarUntyped<Rcl, Col, EnvCl>
														: [Rcl, Col, EnvCl]
													: [Rcl, Col, EnvCl]
												: never
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
