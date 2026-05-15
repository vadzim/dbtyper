import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenParam } from "../lexer/sql-lexer.ts"
import type { TokenNumber } from "../lexer/sql-lexer.ts"
import type { TokenString } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperError, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ParseParenEnclosedSelect, ParseParenScalarSelect } from "./parse-select.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type {
	SqlTypeShape,
	SqlType,
	SqlText,
	SqlInteger,
	SqlBigint,
	SqlBoolean,
	SqlNumeric,
	SqlUuid,
	SqlNull,
	SqlUnknown,
	SqlTimestamp,
} from "../core/sql-type-shape.ts"
import type { Inc } from "../core/type-utils.ts"

/** Caller-supplied `:name` bindings (names must match lexer param identifiers). */
export type ExpressionParamsShape = Record<string, SqlTypeShape> | readonly SqlTypeShape[]

/** Default `Params` for parsers: `keyof` is `never` (plain `{}` widens against `Record<string, …>`). */
export type EmptyExpressionParams = Record<never, never>

/** Threaded through scalar parse for subqueries: catalog, `:param` bindings, outer aliases visible inside `(SELECT …)`. */
export type ExprParseEnv = {
	db: JsqlDatabaseShape
	params: ExpressionParamsShape
	outerScope: ScopeMap
	positionalParamIndex: number
}

/** True when `T` is `unknown` or `any` (not other types). */
export type IsUnknownOrAny<T> = 0 extends 1 & T ? true : unknown extends T ? (T extends unknown ? true : false) : false

/** Get the current positional parameter index from the environment, defaulting to 0 */
type GetPositionalParamIndex<Env extends ExprParseEnv> = Env["positionalParamIndex"] extends number
	? Env["positionalParamIndex"]
	: 0

/** Increment the positional parameter index in the environment */
type IncrementPositionalParamIndex<Env extends ExprParseEnv> = {
	db: Env["db"]
	params: Env["params"]
	outerScope: Env["outerScope"]
	positionalParamIndex: Inc[GetPositionalParamIndex<Env>]
}

/** Identifier chain in a scalar expression AST (syntax only until {@link ResolveExpressionAST}). */
export type ScalarIdentParts = readonly [string] | readonly [string, string] | readonly [string, string, string]

/** Comparison operator in {@link ScalarExprAst} `cmp` (resolved like PostgreSQL class rules). */
export type ScalarCmpOp = "eq" | "ne" | "lt" | "le" | "gt" | "ge"

/**
 * Expression AST for SELECT-list parsing (arithmetic, boolean `AND`/`OR`/`NOT`, comparisons, `IS [NOT] NULL`, `IN (...)`, simple and searched `CASE`, etc.).
 * Resolve with {@link ResolveExpressionAST} when `FROM` scope is known.
 */
export type ScalarExprAst =
	| { kind: "true" }
	| { kind: "false" }
	| { kind: "sql_null" }
	| { kind: "string"; value: string }
	| { kind: "number"; raw: string }
	| { kind: "param"; name: string }
	| { kind: "positional-param"; index: number }
	| { kind: "col"; parts: ScalarIdentParts }
	/** `alias.*` in a SELECT list item (resolved against JOIN scope). */
	| { kind: "alias_table_star"; alias: string }
	/** `schema.table.*` in a SELECT list item (resolved against catalog + JOIN scope). */
	| { kind: "qualified_table_star"; schema: string; table: string }
	| { kind: "neg"; inner: ScalarExprAst }
	| { kind: "add"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "sub"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "mul"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "not"; inner: ScalarExprAst }
	| { kind: "and"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "or"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "cmp"; op: ScalarCmpOp; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "is_null"; expr: ScalarExprAst }
	| { kind: "is_not_null"; expr: ScalarExprAst }
	| { kind: "in_list"; expr: ScalarExprAst; items: readonly ScalarExprAst[] }
	| { kind: "in_subquery"; expr: ScalarExprAst; sub: JsqlSelectStatementResult }
	| { kind: "scalar_subquery"; sel: JsqlSelectStatementResult }
	| { kind: "exists_subquery"; sub: JsqlSelectStatementResult }
	/** PostgreSQL `= ANY(array_expr)` or `= ANY(subquery)` */
	| { kind: "any_op"; op: string; left: ScalarExprAst; right: ScalarExprAst | JsqlSelectStatementResult }
	/** PostgreSQL `= ALL(array_expr)` or `= ALL(subquery)` */
	| { kind: "all_op"; op: string; left: ScalarExprAst; right: ScalarExprAst | JsqlSelectStatementResult }
	/** PostgreSQL `= SOME(array_expr)` or `= SOME(subquery)` (alias for ANY) */
	| { kind: "some_op"; op: string; left: ScalarExprAst; right: ScalarExprAst | JsqlSelectStatementResult }
	/** PostgreSQL `ARRAY[` … `]` constructor (comma-separated scalar expressions). */
	| { kind: "array_ctor"; elements: readonly ScalarExprAst[] }
	/** One-based or zero-based semantics are dialect-specific at runtime; MVP element access typing. */
	| { kind: "array_index"; base: ScalarExprAst; index: ScalarExprAst }
	/** PostgreSQL `expr::typename` (supports multi-word types and `varchar(`…`)` modifiers). */
	| { kind: "pg_cast"; expr: ScalarExprAst; type_parts: readonly string[] }
	/** Standard `CAST(expr AS typename)`. */
	| { kind: "sql_cast"; expr: ScalarExprAst; type_parts: readonly string[] }
	| { kind: "between"; expr: ScalarExprAst; low: ScalarExprAst; high: ScalarExprAst }
	| { kind: "like"; expr: ScalarExprAst; pattern: ScalarExprAst; case_insensitive: boolean }
	/** PostgreSQL `~` / `~*` (regex match; `case_insensitive` from `~*`). */
	| { kind: "pg_regex_match"; expr: ScalarExprAst; pattern: ScalarExprAst; case_insensitive: boolean }
	/** `CASE WHEN … THEN … [WHEN … THEN …]* [ELSE …] END` (searched form). */
	| {
			kind: "case_searched"
			arms: readonly { when: ScalarExprAst; then: ScalarExprAst }[]
			else_: ScalarExprAst | null
	  }
	/** `CASE expr WHEN … THEN … [WHEN … THEN …]* [ELSE …] END` (simple form; `WHEN` values compare to `expr` like `=`). */
	| {
			kind: "case_simple"
			discriminant: ScalarExprAst
			arms: readonly { when: ScalarExprAst; then: ScalarExprAst }[]
			else_: ScalarExprAst | null
	  }
	| { kind: "custom_op"; op: string; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "exp"; left: ScalarExprAst; right: ScalarExprAst }
	| { kind: "mod"; left: ScalarExprAst; right: ScalarExprAst }
	| {
			kind: "function_call"
			name: string
			args: readonly (ScalarExprAst | { kind: "star" })[]
	  }
	| {
			kind: "window_function"
			name: string
			args: readonly (ScalarExprAst | { kind: "star" })[]
			over: {
				partition_by?: readonly ScalarExprAst[]
				order_by: readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
			}
	  }

/** Lowercase joined SQL type name for cast resolution (e.g. `["double","precision"]` → `"double precision"`). */
export type SqlCastTypeNorm<P extends readonly string[]> = P extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? Lowercase<H>
		: `${Lowercase<H>} ${SqlCastTypeNorm<T>}`
	: string

/** `AS` / `::` type list: identifiers, optional `(…)` after a name, until `)` (CAST) or non-type token (`::` chain). */
type ParseSqlTypeName<Tokens extends ParserMonad, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<R1>, TokenKey<")">> extends [infer R2 extends ParserMonad, infer Rs]
					? Rs extends DbtyperErrorShape
						? SkipFailedExpression<R2, Rs>
						: ParseSqlTypeName<SkipToken<R2>, readonly [...Acc, W]>
					: never
				: PeekToken<R1> extends TokenKey<".">
					? ParseSqlTypeName<SkipToken<R1>, readonly [...Acc, W]>
					: PeekToken<R1> extends TokenIdent<string>
						? ParseSqlTypeName<R1, readonly [...Acc, W]>
						: [R1, readonly [...Acc, W]]
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? Acc extends readonly []
				? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
				: [Tokens, Acc]
			: Acc extends readonly []
				? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>>
				: [Tokens, Acc]

/** True when `C` has exactly one own key (one projected column). */
type SingleProjectionColumn<C extends Record<string, unknown>> = keyof C extends infer A
	? A extends keyof C
		? { [B in keyof C]: B extends A ? 1 : 0 }[keyof C] extends 1
			? true
			: false
		: false
	: false

type ParseCastKeywordOperand<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"(">
				? SkipToken<R0> extends infer R1 extends ParserMonad
					? ParseOrScalarUntyped<R1, Env> extends [
							infer R2 extends ParserMonad,
							infer Inner,
							infer Env2 extends ExprParseEnv,
						]
						? Inner extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<R2, Inner, Env2>
							: Inner extends ScalarExprAst
								? PeekToken<R2> extends TokenKey<"as">
									? SkipToken<R2> extends infer R3 extends ParserMonad
										? ParseSqlTypeName<R3, []> extends [infer R4 extends ParserMonad, infer Parts]
											? Parts extends DbtyperErrorShape
												? SkipFailedExpressionWithEnv<R4, Parts, Env2>
												: Parts extends readonly []
													? SkipFailedExpressionWithEnv<
															R4,
															FormatError<
																Errors["EXPECTED_TYPE_NAME"],
																["after CAST ... AS"]
															>,
															Env2
														>
													: Parts extends readonly string[]
														? PeekToken<R4> extends infer TokCl
															? SkipToken<R4> extends infer R5 extends ParserMonad
																? TokCl extends TokenKey<")">
																	? [
																			R5,
																			{
																				kind: "sql_cast"
																				expr: Inner
																				type_parts: Parts
																			},
																			Env2,
																		]
																	: [
																			R5,
																			FormatError<
																				Errors["EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE"],
																				[]
																			>,
																			Env2,
																		]
																: never
															: never
														: never
											: never
										: never
									: SkipFailedExpressionWithEnv<
											R2,
											FormatError<Errors["EXPECTED_AS_IN_CAST"], []>,
											Env2
										>
								: never
						: never
					: never
				: SkipFailedExpressionWithEnv<R0, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_CAST"], []>, Env>
			: never
		: never

type ParsePgCastSuffixTail<Tokens extends ParserMonad, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"::">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? ParseSqlTypeName<R0, []> extends [infer R1 extends ParserMonad, infer Parts]
				? Parts extends DbtyperErrorShape
					? SkipFailedExpression<R1, Parts>
					: Parts extends readonly []
						? SkipFailedExpression<R1, FormatError<Errors["EXPECTED_TYPE_NAME"], ["after ::"]>>
						: Parts extends readonly string[]
							? ParsePgCastSuffixTail<R1, { kind: "pg_cast"; expr: Acc; type_parts: Parts }>
							: never
				: never
			: never
		: [Tokens, Acc]

/** Additive / multiplicative / unary-minus / primary (no `AND`/`OR`/`NOT`/comparisons at this level). */
type ParseAddScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenIdent<string>
		? ParseScalarExprUntypedFromIdent<Tokens, Env>
		: ParseScalarExprUntypedNonIdent<Tokens, Env>

type TokenToCmpOp<Tok> =
	Tok extends TokenKey<"=">
		? "eq"
		: Tok extends TokenKey<"<>"> | TokenKey<"!=">
			? "ne"
			: Tok extends TokenKey<"<">
				? "lt"
				: Tok extends TokenKey<"<=">
					? "le"
					: Tok extends TokenKey<">">
						? "gt"
						: Tok extends TokenKey<">=">
							? "ge"
							: never

/** Comma-separated scalar expressions inside `IN (` … `)` (untyped AST for resolve). */
type ParseInListUntypedAccum<
	Tokens extends ParserMonad,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends ParserMonad, infer E, infer Env1 extends ExprParseEnv]
		? E extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E, Env1>
			: E extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<")">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? [R2, readonly [...Acc, E], Env1]
						: never
					: PeekToken<R1> extends TokenKey<",">
						? ParseInListUntypedAccum<SkipToken<R1>, readonly [...Acc, E], Env1>
						: SkipFailedExpressionWithEnv<
								R1,
								FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST"], []>,
								Env1
							>
				: never
		: never

type ParseInListUntypedTail<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<")">
		? SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["IN_LIST_MUST_NOT_BE_EMPTY"], []>, Env>
		: PeekToken<Tokens> extends TokenKey<"select">
			? ParseParenEnclosedSelect<Tokens, Env["db"], Env["params"], Env["outerScope"]> extends [
					infer R9 extends ParserMonad,
					infer Sub,
				]
				? Sub extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R9, Sub, Env>
					: Sub extends JsqlSelectStatementResult
						? [R9, Sub, Env]
						: never
				: never
			: ParseInListUntypedAccum<Tokens, readonly [], Env>

type ParseInListUntypedAfterInKw<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"in">
		? SkipToken<Tokens> extends infer R8 extends ParserMonad
			? PeekToken<R8> extends TokenKey<"(">
				? ParseInListUntypedTail<SkipToken<R8>, Env> extends [
						infer R9 extends ParserMonad,
						infer ListRes,
						infer Env9 extends ExprParseEnv,
					]
					? ListRes extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R9, ListRes, Env9>
						: ListRes extends JsqlSelectStatementResult
							? [R9, { kind: "in_subquery"; expr: L; sub: ListRes }, Env9]
							: ListRes extends readonly ScalarExprAst[]
								? [R9, { kind: "in_list"; expr: L; items: ListRes }, Env9]
								: never
					: never
				: SkipFailedExpressionWithEnv<R8, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_IN"], []>, Env>
			: never
		: never

type ParseBetweenAfterL<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"between">
		? SkipToken<Tokens> extends infer Rb extends ParserMonad
			? ParseAddScalarUntyped<Rb, Env> extends [
					infer Rlow extends ParserMonad,
					infer Low,
					infer EnvLow extends ExprParseEnv,
				]
				? Low extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rlow, Low, EnvLow>
					: PeekToken<Rlow> extends TokenKey<"and">
						? SkipToken<Rlow> extends infer Ra extends ParserMonad
							? ParseOtherOpScalarUntyped<Ra, EnvLow> extends [
									infer Rh extends ParserMonad,
									infer High,
									infer EnvH extends ExprParseEnv,
								]
								? High extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<Rh, High, EnvH>
									: [Rh, { kind: "between"; expr: L; low: Low; high: High }, EnvH]
								: never
							: never
						: SkipFailedExpressionWithEnv<
								Rlow,
								FormatError<Errors["EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS"], []>,
								EnvLow
							>
				: never
			: never
		: never

type ParseLikeAfterL<
	Tokens extends ParserMonad,
	L extends ScalarExprAst,
	CI extends boolean,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends infer TokKw
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokKw extends TokenKey<"like"> | TokenKey<"ilike">
				? ParseOtherOpScalarUntyped<R1, Env> extends [
						infer R2 extends ParserMonad,
						infer Pat,
						infer Env2 extends ExprParseEnv,
					]
					? Pat extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, Pat, Env2>
						: [R2, { kind: "like"; expr: L; pattern: Pat; case_insensitive: CI }, Env2]
					: never
				: never
			: never
		: never

type ParseCaseExpectEndKeyword<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"end">
		? SkipToken<Tokens> extends infer Rend extends ParserMonad
			? Acc extends readonly []
				? SkipFailedExpressionWithEnv<Rend, FormatError<Errors["CASE_REQUIRES_AT_LEAST_ONE_WHEN"], []>, Env>
				: Disc extends null
					? [Rend, { kind: "case_searched"; arms: Acc; else_: ElseB }, Env]
					: [Rend, { kind: "case_simple"; discriminant: Disc; arms: Acc; else_: ElseB }, Env]
			: never
		: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_END_AFTER_CASE"], []>, Env>

type ParseCaseAfterOneArm<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, Acc, Disc, Env>
		: PeekToken<Tokens> extends TokenKey<"else">
			? SkipToken<Tokens> extends infer Re extends ParserMonad
				? ParseOrScalarUntyped<Re, Env> extends [
						infer Rel extends ParserMonad,
						infer Ea,
						infer EnvEa extends ExprParseEnv,
					]
					? Ea extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Rel, Ea, EnvEa>
						: Ea extends ScalarExprAst
							? ParseCaseExpectEndKeyword<Rel, Acc, Ea, Disc, EnvEa>
							: never
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"end">
				? ParseCaseExpectEndKeyword<Tokens, Acc, null, Disc, Env>
				: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_WHEN_ELSE_OR_END_IN_CASE"], []>, Env>

type ParseCaseWhenArmsThenElseEnd<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? SkipToken<Tokens> extends infer Rw extends ParserMonad
			? ParseOrScalarUntyped<Rw, Env> extends [
					infer Rcond extends ParserMonad,
					infer Wast,
					infer EnvW extends ExprParseEnv,
				]
				? Wast extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rcond, Wast, EnvW>
					: Wast extends ScalarExprAst
						? PeekToken<Rcond> extends TokenKey<"then">
							? SkipToken<Rcond> extends infer Rt extends ParserMonad
								? ParseOrScalarUntyped<Rt, EnvW> extends [
										infer Rth extends ParserMonad,
										infer Thast,
										infer EnvTh extends ExprParseEnv,
									]
									? Thast extends DbtyperErrorShape
										? SkipFailedExpressionWithEnv<Rth, Thast, EnvTh>
										: Thast extends ScalarExprAst
											? ParseCaseAfterOneArm<
													Rth,
													readonly [...Acc, { when: Wast; then: Thast }],
													Disc,
													EnvTh
												>
											: never
									: never
								: never
							: SkipFailedExpressionWithEnv<
									Rcond,
									FormatError<Errors["EXPECTED_THEN_AFTER_CASE_WHEN"], []>,
									EnvW
								>
						: never
				: never
			: never
		: never

/** After `CASE` keyword: searched `CASE WHEN` or simple `CASE expr WHEN`. */
type ParseCaseAfterCaseKw<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, readonly [], null, Env>
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer Rd extends ParserMonad,
					infer Dast,
					infer EnvD extends ExprParseEnv,
			  ]
			? Dast extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<Rd, Dast, EnvD>
				: Dast extends ScalarExprAst
					? PeekToken<Rd> extends TokenKey<"when">
						? ParseCaseWhenArmsThenElseEnd<Rd, readonly [], Dast, EnvD>
						: SkipFailedExpressionWithEnv<
								Rd,
								FormatError<Errors["EXPECTED_WHEN_AFTER_CASE_EXPRESSION"], []>,
								EnvD
							>
					: never
			: never

type ParseAfterIsUntyped<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R5 extends ParserMonad
			? PeekToken<R5> extends TokenKey<"null">
				? [SkipToken<R5>, { kind: "is_not_null"; expr: L }, Env]
				: SkipFailedExpressionWithEnv<R5, FormatError<Errors["EXPECTED_NULL_AFTER_IS_NOT"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? [SkipToken<Tokens>, { kind: "is_null"; expr: L }, Env]
			: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_NULL_AFTER_IS"], []>, Env>

type IsRelOp<T> =
	T extends TokenKey<"=">
		? true
		: T extends TokenKey<"<>">
			? true
			: T extends TokenKey<"!=">
				? true
				: T extends TokenKey<"<=">
					? true
					: T extends TokenKey<">=">
						? true
						: T extends TokenKey<"<">
							? true
							: T extends TokenKey<">">
								? true
								: false

type ParseAnyAllSomeAfterOp<Tokens extends ParserMonad, L extends ScalarExprAst, OpToken, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer Kw
		? Kw extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"(">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"select">
							? ParseParenEnclosedSelect<R2, Env["db"], Env["params"], Env["outerScope"]> extends [
									infer R3 extends ParserMonad,
									infer Sub,
								]
								? Sub extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<R3, Sub, Env>
									: Sub extends JsqlSelectStatementResult
										? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
											? Kw extends TokenKey<"any">
												? [R3, { kind: "any_op"; op: Op; left: L; right: Sub }, Env]
												: Kw extends TokenKey<"all">
													? [R3, { kind: "all_op"; op: Op; left: L; right: Sub }, Env]
													: Kw extends TokenKey<"some">
														? [R3, { kind: "some_op"; op: Op; left: L; right: Sub }, Env]
														: never
											: SkipFailedExpressionWithEnv<R3, never, Env>
										: never
								: never
							: ParseOrScalarUntyped<R2, Env> extends [
										infer R4 extends ParserMonad,
										infer ArrExpr,
										infer Env4 extends ExprParseEnv,
								  ]
								? ArrExpr extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<R4, ArrExpr, Env4>
									: ArrExpr extends ScalarExprAst
										? PeekToken<R4> extends TokenKey<")">
											? SkipToken<R4> extends infer R5 extends ParserMonad
												? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
													? Kw extends TokenKey<"any">
														? [
																R5,
																{ kind: "any_op"; op: Op; left: L; right: ArrExpr },
																Env4,
															]
														: Kw extends TokenKey<"all">
															? [
																	R5,
																	{ kind: "all_op"; op: Op; left: L; right: ArrExpr },
																	Env4,
																]
															: Kw extends TokenKey<"some">
																? [
																		R5,
																		{
																			kind: "some_op"
																			op: Op
																			left: L
																			right: ArrExpr
																		},
																		Env4,
																	]
																: never
													: SkipFailedExpressionWithEnv<R5, never, Env4>
												: never
											: SkipFailedExpressionWithEnv<
													R4,
													FormatError<
														Errors["EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION"],
														[]
													>,
													Env4
												>
										: never
								: never
						: never
					: SkipFailedExpressionWithEnv<
							R1,
							FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME"], []>,
							Env
						>
				: never
			: never
		: never

type ParseAfterAddScalarRelIsInUntyped<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer P
		? IsRelOp<P> extends true
			? SkipToken<Tokens> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
					? ParseAnyAllSomeAfterOp<R2, L, P, Env>
					: ParseOtherOpScalarUntyped<R2, Env> extends [
								infer R3 extends ParserMonad,
								infer Rhs,
								infer Env3 extends ExprParseEnv,
						  ]
						? Rhs extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<R3, Rhs, Env3>
							: TokenToCmpOp<P> extends infer Cop extends ScalarCmpOp
								? [R3, { kind: "cmp"; op: Cop; left: L; right: Rhs }, Env3]
								: SkipFailedExpressionWithEnv<R3, never, Env3>
						: never
				: never
			: P extends TokenKey<"is">
				? ParseAfterIsUntyped<SkipToken<Tokens>, L, Env>
				: P extends TokenKey<"in">
					? ParseInListUntypedAfterInKw<Tokens, L, Env>
					: P extends TokenKey<"between">
						? ParseBetweenAfterL<Tokens, L, Env>
						: P extends TokenKey<"~">
							? SkipToken<Tokens> extends infer Rregex extends ParserMonad
								? ParseOtherOpScalarUntyped<Rregex, Env> extends [
										infer Rrp extends ParserMonad,
										infer Pat,
										infer EnvRp extends ExprParseEnv,
									]
									? Pat extends DbtyperErrorShape
										? SkipFailedExpressionWithEnv<Rrp, Pat, EnvRp>
										: [
												Rrp,
												{
													kind: "pg_regex_match"
													expr: L
													pattern: Pat
													case_insensitive: false
												},
												EnvRp,
											]
									: never
								: never
							: P extends TokenKey<"~*">
								? SkipToken<Tokens> extends infer Rregexi extends ParserMonad
									? ParseOtherOpScalarUntyped<Rregexi, Env> extends [
											infer Rrpi extends ParserMonad,
											infer Pati,
											infer EnvRpi extends ExprParseEnv,
										]
										? Pati extends DbtyperErrorShape
											? SkipFailedExpressionWithEnv<Rrpi, Pati, EnvRpi>
											: [
													Rrpi,
													{
														kind: "pg_regex_match"
														expr: L
														pattern: Pati
														case_insensitive: true
													},
													EnvRpi,
												]
										: never
									: never
								: P extends TokenKey<"!~">
									? SkipToken<Tokens> extends infer Rnotregex extends ParserMonad
										? ParseOtherOpScalarUntyped<Rnotregex, Env> extends [
												infer Rrpn extends ParserMonad,
												infer Patn,
												infer EnvRpn extends ExprParseEnv,
											]
											? Patn extends DbtyperErrorShape
												? SkipFailedExpressionWithEnv<Rrpn, Patn, EnvRpn>
												: [
														Rrpn,
														{
															kind: "not"
															inner: {
																kind: "pg_regex_match"
																expr: L
																pattern: Patn
																case_insensitive: false
															}
														},
														EnvRpn,
													]
											: never
										: never
									: P extends TokenKey<"!~*">
										? SkipToken<Tokens> extends infer Rnotregexi extends ParserMonad
											? ParseOtherOpScalarUntyped<Rnotregexi, Env> extends [
													infer Rrpni extends ParserMonad,
													infer Patni,
													infer EnvRpni extends ExprParseEnv,
												]
												? Patni extends DbtyperErrorShape
													? SkipFailedExpressionWithEnv<Rrpni, Patni, EnvRpni>
													: [
															Rrpni,
															{
																kind: "not"
																inner: {
																	kind: "pg_regex_match"
																	expr: L
																	pattern: Patni
																	case_insensitive: true
																}
															},
															EnvRpni,
														]
												: never
											: never
										: P extends TokenKey<"like">
											? ParseLikeAfterL<Tokens, L, false, Env>
											: P extends TokenKey<"ilike">
												? ParseLikeAfterL<Tokens, L, true, Env>
												: [Tokens, L, Env]
		: never

type ParseRelScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer E1,
		infer Env1 extends ExprParseEnv,
	]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E1, Env1>
			: E1 extends ScalarExprAst
				? ParseAfterAddScalarRelIsInUntyped<R1, E1, Env1>
				: never
		: never

type ParseNotScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"exists">
		? SkipToken<Tokens> extends infer Rex0 extends ParserMonad
			? PeekToken<Rex0> extends TokenKey<"(">
				? SkipToken<Rex0> extends infer Rex1 extends ParserMonad
					? PeekToken<Rex1> extends TokenKey<"select">
						? ParseParenEnclosedSelect<Rex1, Env["db"], Env["params"], Env["outerScope"]> extends [
								infer Rex2 extends ParserMonad,
								infer Sub,
							]
							? Sub extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<Rex2, Sub, Env>
								: Sub extends JsqlSelectStatementResult
									? [Rex2, { kind: "exists_subquery"; sub: Sub }, Env]
									: never
							: never
						: SkipFailedExpressionWithEnv<
								Rex1,
								FormatError<Errors["EXPECTED_SELECT_IN_EXISTS_SUBQUERY"], []>,
								Env
							>
					: never
				: SkipFailedExpressionWithEnv<Rex0, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_EXISTS"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"not">
			? SkipToken<Tokens> extends infer Rn extends ParserMonad
				? ParseNotScalarUntyped<Rn, Env> extends [
						infer Ru extends ParserMonad,
						infer U,
						infer EnvU extends ExprParseEnv,
					]
					? U extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Ru, U, EnvU>
						: U extends ScalarExprAst
							? [Ru, { kind: "not"; inner: U }, EnvU]
							: never
					: never
				: never
			: ParseRelScalarUntyped<Tokens, Env>

type ParseAndLoopScalarUntyped<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"and">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseNotScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? ParseAndLoopScalarUntyped<R2, { kind: "and"; left: Acc; right: E1 }, Env1>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

type ParseAndScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseNotScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseAndLoopScalarUntyped<R0, E0, Env0>
				: never
		: never

type ParseOrLoopScalarUntyped<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"or">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseAndScalarUntyped<R1, Env> extends [
					infer R2 extends ParserMonad,
					infer E1,
					infer Env1 extends ExprParseEnv,
				]
				? E1 extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R2, E1, Env1>
					: E1 extends ScalarExprAst
						? ParseOrLoopScalarUntyped<R2, { kind: "or"; left: Acc; right: E1 }, Env1>
						: never
				: never
			: never
		: [Tokens, Acc, Env]

type ParseOrScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseAndScalarUntyped<Tokens, Env> extends [infer R0 extends ParserMonad, infer E0, infer Env0 extends ExprParseEnv]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ParseOrLoopScalarUntyped<R0, E0, Env0>
				: never
		: never

type ResolveFunctionArgsList<
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Acc extends readonly SqlTypeShape[] = [],
> = Args extends readonly [infer First, ...infer Rest extends readonly (ScalarExprAst | { kind: "star" })[]]
	? First extends { kind: "star" }
		? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, SqlUnknown]>
		: First extends ScalarExprAst
			? ResolveExpressionAST<First, Db, Scope, Params> extends infer Res
				? Res extends DbtyperErrorShape
					? Res
					: Res extends SqlTypeShape
						? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, Res]>
						: never
				: never
			: never
	: Acc

type ArgsTupleContainsStar<Args extends readonly (ScalarExprAst | { kind: "star" })[]> = Args extends readonly [
	infer Head,
	...infer Tail extends readonly (ScalarExprAst | { kind: "star" })[],
]
	? Head extends { kind: "star" }
		? true
		: ArgsTupleContainsStar<Tail>
	: false

type ResolveFunctionCall<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	L extends string = Lowercase<Name>,
> =
	ArgsTupleContainsStar<Args> extends true
		? L extends "count"
			? ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
				? ArgsRes extends DbtyperErrorShape
					? ArgsRes
					: ArgsRes extends readonly SqlTypeShape[]
						? SqlBigint
						: never
				: never
			: FormatError<Errors["STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT"], []>
		: ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
			? ArgsRes extends DbtyperErrorShape
				? ArgsRes
				: ArgsRes extends readonly SqlTypeShape[]
					? L extends "count"
						? SqlBigint
						: L extends "lower" | "upper"
							? ArgsRes extends readonly [SqlTypeShape, ...infer _Rest]
								? SqlText
								: ArgsRes extends readonly []
									? FormatError<Errors["FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"], []>
									: FormatError<Errors["FUNCTION_EXPECTS_TEXT_ARGUMENT"], []>
							: L extends "coalesce"
								? ArgsRes extends readonly []
									? FormatError<Errors["COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT"], []>
									: ArgsRes[0] extends SqlTypeShape
										? ArgsRes[0]
										: SqlUnknown
								: L extends "now"
									? ArgsRes extends readonly []
										? SqlTimestamp
										: FormatError<Errors["NOW_TAKES_NO_ARGUMENTS"], []>
									: L extends "sum" | "avg"
										? ArgsRes extends readonly [SqlTypeShape, ...infer _R]
											? SqlNumeric
											: FormatError<Errors["SUM_REQUIRES_AN_ARGUMENT"], []>
										: L extends "min" | "max"
											? ArgsRes extends readonly [infer First extends SqlTypeShape, ...infer _R]
												? First
												: FormatError<Errors["FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"], []>
											: L extends "uuid_generate_v4" | "gen_random_uuid"
												? ArgsRes extends readonly []
													? SqlUuid
													: FormatError<Errors["THIS_FUNCTION_TAKES_NO_ARGUMENTS"], []>
												: L extends "array_length"
													? ArgsRes extends readonly [
															infer S1 extends SqlTypeShape,
															infer _S2 extends SqlTypeShape,
														]
														? S1["type"] extends "array" | "unknown"
															? SqlInteger
															: FormatError<
																	Errors["ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER"],
																	[]
																>
														: FormatError<Errors["ARRAY_LENGTH_REQUIRES_2_ARGUMENTS"], []>
													: L extends "array_append"
														? ArgsRes extends readonly [
																infer S1 extends SqlTypeShape,
																SqlTypeShape,
															]
															? S1["type"] extends "array" | "unknown"
																? SqlUnknown
																: FormatError<
																		Errors["ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT"],
																		[]
																	>
															: FormatError<
																	Errors["ARRAY_APPEND_REQUIRES_2_ARGUMENTS"],
																	[]
																>
														: L extends "array_prepend"
															? ArgsRes extends readonly [
																	SqlTypeShape,
																	infer S2 extends SqlTypeShape,
																]
																? S2["type"] extends "array" | "unknown"
																	? SqlUnknown
																	: FormatError<
																			Errors["ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY"],
																			[]
																		>
																: FormatError<
																		Errors["ARRAY_PREPEND_REQUIRES_2_ARGUMENTS"],
																		[]
																	>
															: L extends "unnest"
																? ArgsRes extends readonly [
																		infer S1 extends SqlTypeShape,
																	]
																	? S1["type"] extends "array" | "unknown"
																		? SqlUnknown
																		: FormatError<
																				Errors["UNNEST_EXPECTS_AN_ARRAY"],
																				[]
																			>
																	: FormatError<
																			Errors["UNNEST_REQUIRES_1_ARGUMENT"],
																			[]
																		>
																: "functions" extends keyof Db
																	? Db["functions"] extends Record<string, unknown>
																		? L extends keyof Db["functions"]
																			? Db["functions"][L &
																					keyof Db["functions"]] extends infer FnType
																				? FnType extends SqlTypeShape
																					? FnType
																					: FnType extends string
																						? {
																								type: FnType
																								arg: null
																								nullable: false
																							}
																						: SqlUnknown
																				: SqlUnknown
																			: FormatError<
																					Errors["UNKNOWN_FUNCTION"],
																					[Name]
																				>
																		: FormatError<
																				Errors["UNKNOWN_FUNCTION"],
																				[Name]
																			>
																	: FormatError<Errors["UNKNOWN_FUNCTION"], [Name]>
					: never
			: never

type ResolveWindowFunction<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	L extends string = Lowercase<Name>,
> = L extends "row_number"
	? Args extends readonly []
		? SqlBigint
		: FormatError<Errors["ROW_NUMBER_TAKES_NO_ARGUMENTS"], []>
	: L extends "rank" | "dense_rank"
		? Args extends readonly []
			? SqlBigint
			: FormatError<Errors["RANK_DENSE_RANK_TAKES_NO_ARGUMENTS"], []>
		: L extends "lag" | "lead"
			? ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
				? ArgsRes extends DbtyperErrorShape
					? ArgsRes
					: ArgsRes extends readonly [infer S extends SqlTypeShape, ...infer _Rest]
						? S
						: ArgsRes extends readonly []
							? FormatError<Errors["LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT"], []>
							: FormatError<Errors["INVALID_LAG_LEAD_ARGUMENTS"], []>
				: never
			: FormatError<Errors["UNKNOWN_WINDOW_FUNCTION"], []>

type ResolveCustomOp<
	Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperErrorShape
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? Op extends "@>" | "&&" | "<@"
								? SqlBoolean
								: Op extends "||"
									? Lv["type"] extends "array"
										? Rv["type"] extends "text"
											? FormatError<Errors["CANNOT_CONCATENATE_ARRAY_WITH_TEXT"], []>
											: Rv["type"] extends "array"
												? Lv
												: Lv
										: Rv["type"] extends "array"
											? Lv["type"] extends "text"
												? FormatError<Errors["CANNOT_CONCATENATE_TEXT_WITH_ARRAY"], []>
												: Rv
											: Lv["type"] extends "text"
												? Rv["type"] extends
														| "text"
														| "integer"
														| "bigint"
														| "numeric"
														| "uuid"
														| "boolean"
													? SqlText
													: FormatError<
															Errors["CANNOT_CONCATENATE_TEXT_WITH_TYPE"],
															[Rv["type"]]
														>
												: Rv["type"] extends "text"
													? Lv["type"] extends
															| "integer"
															| "bigint"
															| "numeric"
															| "uuid"
															| "boolean"
														? SqlText
														: FormatError<
																Errors["CANNOT_CONCATENATE_TYPE_WITH_TEXT"],
																[Lv["type"]]
															>
													: FormatError<
															Errors["CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND"],
															[]
														>
									: SqlUnknown
							: never
						: never
				: never
		: never

type ResolveArrayCtorElements<
	Els extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	AccTypes extends readonly SqlTypeShape[] = readonly [],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer V
		? V extends DbtyperErrorShape
			? V
			: V extends SqlTypeShape
				? ResolveArrayCtorElements<R, Db, Scope, Params, readonly [...AccTypes, V]>
				: never
		: never
	: InferArrayType<AccTypes>

type InferArrayType<Types extends readonly SqlTypeShape[]> = Types extends readonly []
	? FormatError<Errors["CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY"], []>
	: Types extends readonly [infer First extends SqlTypeShape, ...infer Rest extends readonly SqlTypeShape[]]
		? UnifyArrayElementTypes<First, Rest> extends infer Unified extends SqlTypeShape
			? { type: "array"; arg: Unified; nullable: false }
			: never
		: never

type UnifyArrayElementTypes<First extends SqlTypeShape, Rest extends readonly SqlTypeShape[]> = Rest extends readonly []
	? First
	: Rest extends readonly [infer Next extends SqlTypeShape, ...infer Tail extends readonly SqlTypeShape[]]
		? SameComparisonClass<First, Next> extends true
			? UnifyArrayElementTypes<First, Tail>
			: SqlUnknown
		: never

// Parse expression to AST to be resolved later when `FROM` scope is known (`OR` … `AND` … `NOT` … comparisons … arithmetic).

export type ParseExpressionAST<Tokens extends ParserMonad, Env extends ExprParseEnv> = ParseOrScalarUntyped<Tokens, Env>

/** Resolve after `FROM` scope is known */
type ExpressionResolvers<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = {
	true: SqlBoolean
	false: SqlBoolean
	sql_null: SqlNull
	string: Ast extends { kind: "string"; value: string } ? SqlText : never
	number: Ast extends { kind: "number"; raw: string } ? SqlInteger : never
	param: Ast extends { kind: "param"; name: infer N extends string } ? LookupParam<Params, N> : never
	"positional-param": Ast extends { kind: "positional-param"; index: infer I extends number }
		? LookupPositionalParam<Params, I>
		: never
	custom_op: Ast extends {
		kind: "custom_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst
	}
		? ResolveCustomOp<Op, L, R, Db, Scope, Params>
		: never
	exp: Ast extends { kind: "exp"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	mod: Ast extends { kind: "mod"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	function_call: Ast extends {
		kind: "function_call"
		name: infer FnName extends string
		args: infer FArgs extends readonly (ScalarExprAst | { kind: "star" })[]
	}
		? ResolveFunctionCall<FnName, FArgs, Db, Scope, Params>
		: never
	window_function: Ast extends {
		kind: "window_function"
		name: infer FnName extends string
		args: infer FArgs extends readonly (ScalarExprAst | { kind: "star" })[]
		over: infer _Over
	}
		? ResolveWindowFunction<FnName, FArgs, Db, Scope, Params>
		: never
	qualified_table_star: FormatError<Errors["QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS"], []>
	alias_table_star: FormatError<Errors["QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS"], []>
	array_ctor: Ast extends {
		kind: "array_ctor"
		elements: infer Els extends readonly ScalarExprAst[]
	}
		? ResolveArrayCtorElements<Els, Db, Scope, Params>
		: never
	array_index: Ast extends {
		kind: "array_index"
		base: infer B extends ScalarExprAst
		index: infer I extends ScalarExprAst
	}
		? ResolveExpressionAST<B, Db, Scope, Params> extends infer Lv
			? Lv extends DbtyperErrorShape
				? Lv
				: ResolveExpressionAST<I, Db, Scope, Params> extends infer Rv
					? Rv extends DbtyperErrorShape
						? Rv
						: Lv extends SqlTypeShape
							? Rv extends SqlTypeShape
								? SqlUnknown
								: never
							: never
					: never
			: never
		: never
	col: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
		? ResolveIdentChainValue<Db, Scope, P>
		: never
	neg: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
		? ResolveScalarExprAstNeg<I, Db, Scope, Params>
		: never
	mul: Ast extends {
		kind: "mul"
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	add: Ast extends {
		kind: "add"
		left: infer La extends ScalarExprAst
		right: infer Ra extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<La, Ra, Db, Scope, Params>
		: never
	sub: Ast extends {
		kind: "sub"
		left: infer Ls extends ScalarExprAst
		right: infer Rs extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<Ls, Rs, Db, Scope, Params>
		: never
	not: Ast extends { kind: "not"; inner: infer I extends ScalarExprAst }
		? ResolveExpressionAST<I, Db, Scope, Params> extends infer V
			? MergeBoolNot<V>
			: never
		: never
	and: Ast extends { kind: "and"; left: infer La extends ScalarExprAst; right: infer Ra extends ScalarExprAst }
		? ResolveExpressionAST<La, Db, Scope, Params> extends infer Lv
			? ResolveExpressionAST<Ra, Db, Scope, Params> extends infer Rv
				? MergeBoolBinary<Lv, Rv, "AND_OPERANDS_MUST_BE_BOOLEAN">
				: never
			: never
		: never
	or: Ast extends { kind: "or"; left: infer Lo extends ScalarExprAst; right: infer Ro extends ScalarExprAst }
		? ResolveExpressionAST<Lo, Db, Scope, Params> extends infer Lv2
			? ResolveExpressionAST<Ro, Db, Scope, Params> extends infer Rv2
				? MergeBoolBinary<Lv2, Rv2, "OR_OPERANDS_MUST_BE_BOOLEAN">
				: never
			: never
		: never
	cmp: Ast extends {
		kind: "cmp"
		op: infer _Op extends ScalarCmpOp
		left: infer Lc extends ScalarExprAst
		right: infer Rc extends ScalarExprAst
	}
		? ResolveExpressionAST<Lc, Db, Scope, Params> extends infer LcV
			? ResolveExpressionAST<Rc, Db, Scope, Params> extends infer RcV
				? LcV extends DbtyperErrorShape
					? LcV
					: RcV extends DbtyperErrorShape
						? RcV
						: LcV extends SqlTypeShape
							? RcV extends SqlTypeShape
								? MergeComparison<LcV, RcV>
								: never
							: never
				: never
			: never
		: never
	is_null: Ast extends { kind: "is_null"; expr: infer E0 extends ScalarExprAst }
		? ResolveExpressionAST<E0, Db, Scope, Params> extends infer V0
			? V0 extends DbtyperErrorShape
				? V0
				: V0 extends SqlTypeShape
					? SqlBoolean
					: never
			: never
		: never
	is_not_null: Ast extends { kind: "is_not_null"; expr: infer E1 extends ScalarExprAst }
		? ResolveExpressionAST<E1, Db, Scope, Params> extends infer V1
			? V1 extends DbtyperErrorShape
				? V1
				: V1 extends SqlTypeShape
					? SqlBoolean
					: never
			: never
		: never
	pg_cast: Ast extends {
		kind: "pg_cast"
		expr: infer Exc extends ScalarExprAst
		type_parts: infer Ptc extends readonly string[]
	}
		? ResolveExpressionAST<Exc, Db, Scope, Params> extends infer Evc
			? Evc extends DbtyperErrorShape
				? Evc
				: Evc extends SqlTypeShape
					? SqlCastTypeNorm<Ptc> extends infer Normc extends string
						? ResolveCastFromShape<Evc, Normc>
						: never
					: never
			: never
		: never
	sql_cast: Ast extends {
		kind: "sql_cast"
		expr: infer Exs extends ScalarExprAst
		type_parts: infer Pts extends readonly string[]
	}
		? ResolveExpressionAST<Exs, Db, Scope, Params> extends infer Evs
			? Evs extends DbtyperErrorShape
				? Evs
				: Evs extends SqlTypeShape
					? SqlCastTypeNorm<Pts> extends infer Norms extends string
						? ResolveCastFromShape<Evs, Norms>
						: never
					: never
			: never
		: never
	between: Ast extends {
		kind: "between"
		expr: infer Eb extends ScalarExprAst
		low: infer Lb extends ScalarExprAst
		high: infer Hb extends ScalarExprAst
	}
		? ResolveExpressionAST<Eb, Db, Scope, Params> extends infer EvB
			? EvB extends DbtyperErrorShape
				? EvB
				: ResolveExpressionAST<Lb, Db, Scope, Params> extends infer LvB
					? LvB extends DbtyperErrorShape
						? LvB
						: ResolveExpressionAST<Hb, Db, Scope, Params> extends infer HvB
							? HvB extends DbtyperErrorShape
								? HvB
								: EvB extends SqlTypeShape
									? LvB extends SqlTypeShape
										? HvB extends SqlTypeShape
											? MergeBetweenBounds<EvB, LvB, HvB>
											: never
										: never
									: never
							: never
					: never
			: never
		: never
	like: Ast extends {
		kind: "like"
		expr: infer Exl extends ScalarExprAst
		pattern: infer Pl extends ScalarExprAst
		case_insensitive: infer _CI extends boolean
	}
		? ResolveExpressionAST<Exl, Db, Scope, Params> extends infer EvL
			? EvL extends DbtyperErrorShape
				? EvL
				: ResolveExpressionAST<Pl, Db, Scope, Params> extends infer PvL
					? PvL extends DbtyperErrorShape
						? PvL
						: EvL extends SqlTypeShape
							? PvL extends SqlTypeShape
								? MergeLikeOperands<EvL, PvL>
								: never
							: never
					: never
			: never
		: never
	pg_regex_match: Ast extends {
		kind: "pg_regex_match"
		expr: infer Exr extends ScalarExprAst
		pattern: infer Pr extends ScalarExprAst
		case_insensitive: infer _CR extends boolean
	}
		? ResolveExpressionAST<Exr, Db, Scope, Params> extends infer EvR
			? EvR extends DbtyperErrorShape
				? EvR
				: ResolveExpressionAST<Pr, Db, Scope, Params> extends infer PvR
					? PvR extends DbtyperErrorShape
						? PvR
						: EvR extends SqlTypeShape
							? PvR extends SqlTypeShape
								? MergeLikeOperands<EvR, PvR>
								: never
							: never
					: never
			: never
		: never
	case_simple: Ast extends {
		kind: "case_simple"
		discriminant: infer Dsc extends ScalarExprAst
		arms: infer ArmsS extends readonly {
			when: ScalarExprAst
			then: ScalarExprAst
		}[]
		else_: infer ElS extends ScalarExprAst | null
	}
		? ResolveCaseSimple<Dsc, ArmsS, ElS, Db, Scope, Params>
		: never
	case_searched: Ast extends {
		kind: "case_searched"
		arms: infer Arms extends readonly {
			when: ScalarExprAst
			then: ScalarExprAst
		}[]
		else_: infer Elc extends ScalarExprAst | null
	}
		? ResolveCaseSearched<Arms, Elc, Db, Scope, Params>
		: never
	exists_subquery: Ast extends {
		kind: "exists_subquery"
		sub: infer _Ex extends JsqlSelectStatementResult
	}
		? SqlBoolean
		: never
	scalar_subquery: Ast extends {
		kind: "scalar_subquery"
		sel: infer Sel extends JsqlSelectStatementResult
	}
		? ResolveScalarSubquerySel<Sel>
		: never
	in_subquery: Ast extends {
		kind: "in_subquery"
		expr: infer Ie extends ScalarExprAst
		sub: infer Isub extends JsqlSelectStatementResult
	}
		? ResolveInSubqueryAst<Ie, Isub, Db, Scope, Params>
		: never
	any_op: Ast extends {
		kind: "any_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	all_op: Ast extends {
		kind: "all_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	some_op: Ast extends {
		kind: "some_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	in_list: Ast extends {
		kind: "in_list"
		expr: infer Eln extends ScalarExprAst
		items: infer Ins extends readonly ScalarExprAst[]
	}
		? ResolveExpressionAST<Eln, Db, Scope, Params> extends infer LvIn
			? LvIn extends DbtyperErrorShape
				? LvIn
				: LvIn extends SqlTypeShape
					? ResolveInListItemsAgainstLeft<LvIn, Ins, Db, Scope, Params>
					: never
			: never
		: never
}

export type ResolveExpressionAST<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Ast extends { kind: infer K extends keyof ExpressionResolvers<any, any, any, any> }
	? ExpressionResolvers<Ast, Db, Scope, Params>[K]
	: never

/** Longest `a` / `a.b` / `a.b.c` chain starting at an identifier (used by SELECT list fast path).
 * Also recognizes `alias.*` and `schema.table.*` via sentinel tuples `["__ats__", alias]` / `["__qts__", sch, tab]`.
 */
type MaximalIdentChain<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? PeekToken<R2> extends TokenKey<"*">
						? SkipToken<R2> extends infer R3 extends ParserMonad
							? [R3, readonly ["__ats__", A]]
							: never
						: PeekToken<R2> extends TokenIdent<infer B extends string>
							? SkipToken<R2> extends infer R3 extends ParserMonad
								? PeekToken<R3> extends TokenKey<".">
									? SkipToken<R3> extends infer R4 extends ParserMonad
										? PeekToken<R4> extends TokenKey<"*">
											? SkipToken<R4> extends infer R5 extends ParserMonad
												? [R5, readonly ["__qts__", A, B]]
												: never
											: PeekToken<R4> extends TokenIdent<infer C extends string>
												? SkipToken<R4> extends infer R5 extends ParserMonad
													? [R5, readonly [A, B, C]]
													: never
												: never
										: never
									: [R3, readonly [A, B]]
								: never
							: never
					: never
				: [R1, readonly [A]]
			: never
		: never

type LookupParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? Params[Name]
	: FormatError<Errors["UNKNOWN_QUERY_PARAMETER"], [Name]>

type LookupPositionalParam<
	Params extends ExpressionParamsShape,
	Index extends number,
> = Params extends readonly SqlTypeShape[]
	? Index extends keyof Params
		? Params[Index]
		: FormatError<Errors["POSITIONAL_PARAMETER_OUT_OF_BOUNDS"], [Index]>
	: FormatError<Errors["POSITIONAL_PARAMETER_REQUIRES_ARRAY"], []>

type ResolveIdentChainValue<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> =
	ResolveColumnRefValue<Db, Scope, Parts> extends infer V
		? V extends DbtyperErrorShape
			? V
			: V extends { sql: infer Sql extends SqlTypeShape }
				? Sql
				: never
		: never

type ParseFunctionArgsAccum<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly (ScalarExprAst | { kind: "star" })[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Acc, Env]
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer R1 extends ParserMonad,
					infer E,
					infer Env1 extends ExprParseEnv,
			  ]
			? E extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R1, E, Env1>
				: E extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, E], Env1]
						: PeekToken<R1> extends TokenKey<",">
							? ParseFunctionArgsAccum<SkipToken<R1>, Env1, readonly [...Acc, E]>
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST"], []>,
									Env1
								>
					: never
			: never

type ParseFunctionArgs<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"*">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<")">
				? [SkipToken<R1>, readonly [{ kind: "star" }], Env]
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_STAR"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? [SkipToken<Tokens>, readonly [], Env]
			: ParseFunctionArgsAccum<Tokens, Env, readonly []>

type ParseOptionalOverClause<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"over">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"(">
				? ParseWindowClauseContent<SkipToken<R1>, FnName, Args, Env>
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OVER"], []>, Env>
			: never
		: [Tokens, { kind: "function_call"; name: FnName; args: Args }, Env]

type ParseWindowClauseContent<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"partition">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"by">
				? ParseWindowPartitionByList<SkipToken<R1>, Env> extends [
						infer R2 extends ParserMonad,
						infer PartitionList,
						infer Env2 extends ExprParseEnv,
					]
					? PartitionList extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, PartitionList, Env2>
						: PartitionList extends readonly ScalarExprAst[]
							? PeekToken<R2> extends TokenKey<"order">
								? ParseWindowOrderByAfterPartition<R2, FnName, Args, PartitionList, Env2>
								: PeekToken<R2> extends TokenKey<")">
									? [
											SkipToken<R2>,
											{
												kind: "window_function"
												name: FnName
												args: Args
												over: { partition_by: PartitionList; order_by: readonly [] }
											},
											Env2,
										]
									: SkipFailedExpressionWithEnv<
											R2,
											FormatError<
												Errors["EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY"],
												[]
											>,
											Env2
										>
							: never
					: never
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_BY_AFTER_PARTITION"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"order">
			? ParseWindowOrderByWithoutPartition<Tokens, FnName, Args, Env>
			: SkipFailedExpressionWithEnv<
					Tokens,
					FormatError<Errors["EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE"], []>,
					Env
				>

type ParseWindowOrderByWithoutPartition<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends ParserMonad
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [
					infer R4 extends ParserMonad,
					infer OrderList,
					infer Env4 extends ExprParseEnv,
				]
				? OrderList extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, OrderList, Env4>
					: OrderList extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
						? PeekToken<R4> extends TokenKey<")">
							? [
									SkipToken<R4>,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { order_by: OrderList }
									},
									Env4,
								]
							: SkipFailedExpressionWithEnv<
									R4,
									FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE"], []>,
									Env4
								>
						: never
				: never
			: SkipFailedExpressionWithEnv<R3, FormatError<Errors["EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE"], []>, Env>
		: never

type ParseWindowOrderByAfterPartition<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	PartitionList extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends ParserMonad
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [
					infer R4 extends ParserMonad,
					infer OrderList,
					infer Env4 extends ExprParseEnv,
				]
				? OrderList extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, OrderList, Env4>
					: OrderList extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
						? PeekToken<R4> extends TokenKey<")">
							? [
									SkipToken<R4>,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { partition_by: PartitionList; order_by: OrderList }
									},
									Env4,
								]
							: SkipFailedExpressionWithEnv<
									R4,
									FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE"], []>,
									Env4
								>
						: never
				: never
			: SkipFailedExpressionWithEnv<R3, FormatError<Errors["EXPECTED_BY_AFTER_ORDER"], []>, Env>
		: never

type ParseWindowPartitionByList<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Expr,
		infer Env1 extends ExprParseEnv,
	]
		? Expr extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Expr, Env1>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<",">
					? ParseWindowPartitionByList<SkipToken<R1>, Env1, readonly [...Acc, Expr]>
					: [R1, readonly [...Acc, Expr], Env1]
				: never
		: never

type ParseWindowOrderByList<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Expr,
		infer Env1 extends ExprParseEnv,
	]
		? Expr extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Expr, Env1>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<"asc">
					? ParseWindowOrderByListTail<
							SkipToken<R1>,
							Env1,
							readonly [...Acc, { expr: Expr; direction: "asc" }]
						>
					: PeekToken<R1> extends TokenKey<"desc">
						? ParseWindowOrderByListTail<
								SkipToken<R1>,
								Env1,
								readonly [...Acc, { expr: Expr; direction: "desc" }]
							>
						: ParseWindowOrderByListTail<R1, Env1, readonly [...Acc, { expr: Expr; direction: null }]>
				: never
		: never

type ParseWindowOrderByListTail<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[],
> = PeekToken<Tokens> extends TokenKey<","> ? ParseWindowOrderByList<SkipToken<Tokens>, Env, Acc> : [Tokens, Acc, Env]

type SqlComparisonClass<Sql extends string> = Sql extends `${infer Base}[]`
	? `array_${SqlComparisonClass<Base>}`
	: Lowercase<Sql> extends
				| "integer"
				| "int"
				| "int2"
				| "int4"
				| "int8"
				| "smallint"
				| "bigint"
				| "real"
				| "float4"
				| "float8"
				| "double precision"
				| "numeric"
				| "decimal"
				| "number"
		? "numeric"
		: Lowercase<Sql> extends "boolean" | "bool"
			? "boolean"
			: Lowercase<Sql> extends "text" | "varchar" | "character varying" | "char"
				? "text"
				: Lowercase<Sql> extends "uuid"
					? "uuid"
					: Lowercase<Sql> extends
								| "date"
								| "time"
								| "time with time zone"
								| "timestamp"
								| "timestamp with time zone"
						? "datetime"
						: "unknown"

type IsSqlNumericType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "numeric"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "numeric"
			? true
			: false
		: false

type IsSqlBooleanType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "boolean"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "boolean"
			? true
			: false
		: false

type IsSqlTextType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "text"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "text"
			? true
			: false
		: false

export type SameComparisonClass<
	SqlL extends string | SqlTypeShape,
	SqlR extends string | SqlTypeShape,
> = SqlL extends SqlTypeShape
	? SqlR extends SqlTypeShape
		? SqlComparisonClass<SqlL["type"]> extends "unknown"
			? true
			: SqlComparisonClass<SqlR["type"]> extends "unknown"
				? true
				: SqlComparisonClass<SqlL["type"]> extends SqlComparisonClass<SqlR["type"]>
					? true
					: false
		: false
	: SqlR extends SqlTypeShape
		? false
		: SqlL extends string
			? SqlR extends string
				? SqlComparisonClass<SqlL> extends "unknown"
					? true
					: SqlComparisonClass<SqlR> extends "unknown"
						? true
						: SqlComparisonClass<SqlL> extends SqlComparisonClass<SqlR>
							? true
							: false
				: false
			: false

type MergeComparison<L extends SqlTypeShape, R extends SqlTypeShape> = L["type"] extends "null"
	? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
	: R["type"] extends "null"
		? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
		: SameComparisonClass<L, R> extends true
			? SqlBoolean
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_COMPARISON"], []>

/** Simple `CASE expr WHEN value` — each `value` must be `=`-compatible with `expr` (same errors as comparisons). */
type ValidateCaseSimpleWhenMatch<Disc extends SqlTypeShape, WhenV extends SqlTypeShape> =
	MergeComparison<Disc, WhenV> extends DbtyperErrorShape ? MergeComparison<Disc, WhenV> : true

type MergeBetweenBounds<
	E extends SqlTypeShape,
	Lm extends SqlTypeShape,
	H extends SqlTypeShape,
> = E["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
	: Lm["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
		: H["type"] extends "null"
			? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
			: SameComparisonClass<E, Lm> extends true
				? SameComparisonClass<E, H> extends true
					? SqlBoolean
					: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>
				: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>

type MergeLikeOperands<Expr extends SqlTypeShape, Pat extends SqlTypeShape> = Expr["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
	: Pat["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
		: IsSqlTextType<Expr> extends true
			? IsSqlTextType<Pat> extends true
				? SqlBoolean
				: FormatError<Errors["LIKE_PATTERN_MUST_BE_TEXT"], []>
			: FormatError<Errors["LIKE_LEFT_OPERAND_MUST_BE_TEXT"], []>

type MergeCaseThenAccum<Acc extends SqlTypeShape | null, Tv extends SqlTypeShape> = Acc extends null
	? Tv
	: Acc extends SqlTypeShape
		? Acc["type"] extends "null"
			? Tv["type"] extends "null"
				? SqlNull
				: Tv
			: Tv["type"] extends "null"
				? Acc
				: SameComparisonClass<Acc, Tv> extends true
					? Acc
					: FormatError<Errors["INCOMPATIBLE_TYPES_IN_CASE"], []>
		: never

type ApplyCaseMissingElseNullability<E extends SqlTypeShape, MissingElse extends boolean> = MissingElse extends true
	? { type: E["type"]; arg: E["arg"]; nullable: true }
	: E

type ResolveCaseSearchedArms<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Acc extends SqlTypeShape | null,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends DbtyperErrorShape
			? Wv
			: Wv extends SqlTypeShape
				? IsSqlBooleanType<Wv> extends true
					? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
						? Tv extends DbtyperErrorShape
							? Tv
							: Tv extends SqlTypeShape
								? MergeCaseThenAccum<Acc, Tv> extends infer Merged
									? Merged extends DbtyperErrorShape
										? Merged
										: Merged extends SqlTypeShape
											? ResolveCaseSearchedArms<Rest, ElseB, Db, Scope, Merged, Params>
											: never
									: never
								: never
						: never
					: FormatError<Errors["CASE_WHEN_MUST_BE_BOOLEAN"], []>
				: FormatError<Errors["CASE_WHEN_MUST_BE_BOOLEAN"], []>
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev> extends infer F
						? F extends DbtyperErrorShape
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: never
						: never
					: never
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: never

type ResolveCaseSearched<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = ResolveCaseSearchedArms<Arms, ElseB, Db, Scope, null, Params>

type ResolveCaseSimpleArms<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Disc extends SqlTypeShape,
	Acc extends SqlTypeShape | null,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends DbtyperErrorShape
			? Wv
			: Wv extends SqlTypeShape
				? ValidateCaseSimpleWhenMatch<Disc, Wv> extends infer Match
					? Match extends DbtyperErrorShape
						? Match
						: Match extends true
							? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
								? Tv extends DbtyperErrorShape
									? Tv
									: Tv extends SqlTypeShape
										? MergeCaseThenAccum<Acc, Tv> extends infer Merged
											? Merged extends DbtyperErrorShape
												? Merged
												: Merged extends SqlTypeShape
													? ResolveCaseSimpleArms<
															Rest,
															ElseB,
															Db,
															Scope,
															Disc,
															Merged,
															Params
														>
													: never
											: never
										: never
								: never
							: never
					: never
				: never
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev> extends infer F
						? F extends DbtyperErrorShape
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: never
						: never
					: never
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: never

type ResolveCaseSimple<
	DiscAst extends ScalarExprAst,
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<DiscAst, Db, Scope, Params> extends infer Dv
		? Dv extends DbtyperErrorShape
			? Dv
			: Dv extends SqlTypeShape
				? ResolveCaseSimpleArms<Arms, ElseB, Db, Scope, Dv, null, Params>
				: never
		: never

/** Per-element check for `expr IN (…)` (same class rules as `=`, but `NULL` list elements are rejected). */
type ValidateInListElement<L extends SqlTypeShape, R extends SqlTypeShape> = L["type"] extends "null"
	? never
	: R["type"] extends "null"
		? FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_LIST"], []>
		: SameComparisonClass<L, R> extends true
			? true
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_LIST"], []>

type ResolveInListItemsAgainstLeft<
	Left extends SqlTypeShape,
	Items extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Items extends readonly [infer H extends ScalarExprAst, ...infer Tail extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer Hv
		? Hv extends DbtyperErrorShape
			? Hv
			: Hv extends SqlTypeShape
				? ValidateInListElement<Left, Hv> extends infer V
					? V extends DbtyperErrorShape
						? V
						: V extends true
							? Tail extends readonly []
								? SqlBoolean
								: ResolveInListItemsAgainstLeft<Left, Tail, Db, Scope, Params>
							: never
					: never
				: never
		: never
	: FormatError<Errors["IN_LIST_MUST_NOT_BE_EMPTY"], []>

type ResolveScalarSubquerySel<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["returning"]> extends true
		? keyof S["returning"] extends infer K extends keyof S["returning"]
			? S["returning"][K] extends infer ColType extends SqlTypeShape
				? ColType
				: FormatError<Errors["SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
			: FormatError<Errors["SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
		: FormatError<Errors["SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>

type SubSelectColumnAtom<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["returning"]> extends true
		? keyof S["returning"] extends infer K extends keyof S["returning"]
			? S["returning"][K] extends infer ColType extends SqlTypeShape
				? ColType
				: FormatError<Errors["IN_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
			: FormatError<Errors["IN_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
		: FormatError<Errors["IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>

type ResolveInSubqueryAst<
	Lexpr extends ScalarExprAst,
	Sub extends JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<Lexpr, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: Lv extends SqlTypeShape
				? SubSelectColumnAtom<Sub> extends infer Rv
					? Rv extends DbtyperErrorShape
						? Rv
						: Rv extends SqlTypeShape
							? ValidateInListElement<Lv, Rv> extends infer V
								? V extends DbtyperErrorShape
									? V
									: V extends true
										? SqlBoolean
										: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
								: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
							: never
					: never
				: never
		: never

type ResolveAnyAllSomeOp<
	_Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst | JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: Lv extends SqlTypeShape
				? R extends JsqlSelectStatementResult
					? SubSelectColumnAtom<R> extends infer Rv
						? Rv extends DbtyperErrorShape
							? Rv
							: Rv extends SqlTypeShape
								? MergeComparison<Lv, Rv> extends infer V
									? V extends DbtyperErrorShape
										? V
										: SqlBoolean
									: never
								: never
						: never
					: R extends ScalarExprAst
						? ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
							? Rv extends DbtyperErrorShape
								? Rv
								: Rv extends SqlTypeShape
									? Rv["type"] extends "array" | "unknown"
										? SqlBoolean
										: FormatError<Errors["ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY"], []>
									: never
							: never
						: never
				: never
		: never

type MergeBoolNot<V> = V extends DbtyperErrorShape
	? V
	: V extends SqlTypeShape
		? V["type"] extends "null"
			? FormatError<Errors["NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL"], []>
			: IsSqlBooleanType<V> extends true
				? SqlBoolean
				: FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>
		: FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>

type MergeBoolBinary<
	L,
	R,
	ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN" | "OR_OPERANDS_MUST_BE_BOOLEAN",
> = L extends DbtyperErrorShape
	? L
	: R extends DbtyperErrorShape
		? R
		: L extends SqlTypeShape
			? R extends SqlTypeShape
				? L["type"] extends "null"
					? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
					: R["type"] extends "null"
						? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
						: IsSqlBooleanType<L> extends true
							? IsSqlBooleanType<R> extends true
								? SqlBoolean
								: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
									? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
									: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
							: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
								? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
								: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
				: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
					? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
					: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
			: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
				? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
				: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>

/** `CAST` / `::` result typing for SqlTypeShape (PostgreSQL-oriented compatibility checks). */
type ResolveCastFromShape<Ev extends SqlTypeShape, N extends string> = Ev["type"] extends "null"
	? SqlNull
	: N extends "text" | "varchar" | "character varying" | "char"
		? SqlText
		: N extends "integer" | "int" | "int4" | "smallint" | "int2" | "serial" | "smallserial"
			? Ev["type"] extends "boolean"
				? DbtyperError<4503, "Cannot cast boolean to integer">
				: SqlInteger
			: N extends "bigint" | "int8" | "bigserial"
				? Ev["type"] extends "boolean"
					? DbtyperError<4503, "Cannot cast boolean to integer">
					: SqlBigint
				: N extends "boolean" | "bool"
					? Ev["type"] extends "integer" | "bigint" | "numeric"
						? DbtyperError<4504, "Cannot cast integer to boolean">
						: SqlBoolean
					: N extends "uuid"
						? SqlUuid
						: N extends "bytea"
							? SqlType<"bytea">
							: N extends
										| "timestamp"
										| "timestamp with time zone"
										| "timestamptz"
										| "date"
										| "time"
										| "time with time zone"
										| "timetz"
										| "interval"
								? SqlType<N>
								: N extends "inet" | "cidr"
									? SqlType<N>
									: N extends "tsvector" | "tsquery"
										? SqlType<N>
										: N extends
													| "real"
													| "float4"
													| "double precision"
													| "float8"
													| "numeric"
													| "decimal"
											? SqlNumeric
											: SqlType<N>

// Old unused functions removed (ResolveCastFromAtom, MergeNumericArithmetic)
// These were part of the legacy ExprAtom system and are no longer needed

type ScalarAstNonNumericForMulHead<E extends ScalarExprAst> = E extends { kind: "string" }
	? true
	: E extends { kind: "true" }
		? true
		: E extends { kind: "false" }
			? true
			: E extends { kind: "sql_null" }
				? true
				: E extends { kind: "neg"; inner: infer I extends ScalarExprAst }
					? ScalarAstNonNumericForMulHead<I>
					: E extends {
								kind: "pg_cast"
								expr: infer Ic extends ScalarExprAst
								type_parts: infer Pc extends readonly string[]
						  }
						? SqlCastTypeNorm<Pc> extends infer Nc extends string
							? Nc extends "text" | "varchar" | "character varying" | "char"
								? true
								: ScalarAstNonNumericForMulHead<Ic>
							: ScalarAstNonNumericForMulHead<Ic>
						: E extends {
									kind: "sql_cast"
									expr: infer Ics extends ScalarExprAst
									type_parts: infer Pcs extends readonly string[]
							  }
							? SqlCastTypeNorm<Pcs> extends infer Ncs extends string
								? Ncs extends "text" | "varchar" | "character varying" | "char"
									? true
									: ScalarAstNonNumericForMulHead<Ics>
								: ScalarAstNonNumericForMulHead<Ics>
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

type ParsePostfixArrayIndexTail<Tokens extends ParserMonad, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
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

type TryOperandScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
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
					: PeekToken<Tokens> extends TokenKey<"true">
						? [SkipToken<Tokens>, { kind: "true" }, Env]
						: PeekToken<Tokens> extends TokenKey<"false">
							? [SkipToken<Tokens>, { kind: "false" }, Env]
							: PeekToken<Tokens> extends TokenKey<"null">
								? [SkipToken<Tokens>, { kind: "sql_null" }, Env]
								: PeekToken<Tokens> extends TokenString<infer Str>
									? [SkipToken<Tokens>, { kind: "string"; value: Str }, Env]
									: PeekToken<Tokens> extends TokenNumber<infer Raw>
										? [SkipToken<Tokens>, { kind: "number"; raw: Raw }, Env]
										: PeekToken<Tokens> extends TokenParam<infer P extends string>
											? [SkipToken<Tokens>, { kind: "param"; name: P }, Env]
											: PeekToken<Tokens> extends TokenKey<"?">
												? [
														SkipToken<Tokens>,
														{
															kind: "positional-param"
															index: GetPositionalParamIndex<Env>
														},
														IncrementPositionalParamIndex<Env>,
													]
												: SkipToken<Tokens> extends infer Rbad extends ParserMonad
													? SkipFailedExpressionWithEnv<
															Rbad,
															FormatError<Errors["UNEXPECTED_TOKEN"], []>,
															Env
														>
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

type ParseMulScalarUntypedEntry<Tokens extends ParserMonad, Env extends ExprParseEnv> =
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
					| "?"
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
		: [Tokens, Acc]

type ParseOtherOpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
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

type ParseAddLoopAfterFirstScalarUntyped<
	Tokens extends ParserMonad,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? ParseAddLoopAfterPlusScalarUntyped<Tokens, Acc, Env>
		: PeekToken<Tokens> extends TokenKey<"-">
			? ParseAddLoopAfterMinusScalarUntyped<Tokens, Acc, Env>
			: [Tokens, Acc, Env]

type ParseScalarExprUntypedFromIdent<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends ParserMonad, infer Parts]
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
						? ParseFunctionArgs<SkipToken<Rm>, Env> extends [
								infer After extends ParserMonad,
								infer Args,
								infer EnvAfter extends ExprParseEnv,
							]
							? Args extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<After, Args, EnvAfter>
								: Args extends readonly (ScalarExprAst | { kind: "star" })[]
									? Parts extends readonly [infer FnName extends string]
										? ParseOptionalOverClause<After, FnName, Args, EnvAfter>
										: SkipFailedExpressionWithEnv<
												After,
												FormatError<Errors["QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED"], []>,
												EnvAfter
											>
									: never
							: never
						: PeekToken<Rm> extends infer Pa
							? Pa extends TokenKey<"::">
								? ParsePgCastSuffixTail<Rm, { kind: "col"; parts: Parts }> extends [
										infer Rcast extends ParserMonad,
										infer Casted extends ScalarExprAst,
									]
									? PeekToken<Rcast> extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
										? ParseAddLoopAfterFirstScalarUntyped<Rcast, Casted, Env>
										: [Rcast, Casted, Env]
									: never
								: Pa extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
									? ParseAddLoopAfterFirstScalarUntyped<Rm, { kind: "col"; parts: Parts }, Env>
									: [Rm, { kind: "col"; parts: Parts }, Env]
							: never
					: never
		: never

type ParseScalarExprUntypedNonIdent<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseMulScalarUntypedEntry<Tokens, Env> extends [
		infer R0 extends ParserMonad,
		infer E0,
		infer Env0 extends ExprParseEnv,
	]
		? E0 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R0, E0, Env0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
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

type ResolveScalarExprAstPair<
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperErrorShape
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? Lv["type"] extends "null"
								? FormatError<Errors["NULL_NOT_ALLOWED_ARITHMETIC"], []>
								: Rv["type"] extends "null"
									? FormatError<Errors["NULL_NOT_ALLOWED_ARITHMETIC"], []>
									: IsSqlNumericType<Lv["type"]> extends true
										? IsSqlNumericType<Rv["type"]> extends true
											? Lv
											: FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>
										: FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>
							: never
						: never
				: never
		: never

type ResolveScalarExprAstNeg<
	I extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<I, Db, Scope, Params> extends infer U
		? U extends DbtyperErrorShape
			? U
			: U extends SqlTypeShape
				? IsSqlNumericType<U["type"]> extends true
					? U
					: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
				: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
		: never

// ============================================================================
// OLD PARSING FUNCTIONS REMOVED (2026-05-07)
// ============================================================================
// The following functions were part of the legacy ExprAtom system and have been removed:
// - TryValueOperand
// - ParseValuePgCastSuffix
// - ParseMulLoopAfterFirst
// - ParseMulValue
// - ParseAddLoopAfterFirst
// - ParseAddValue
//
// These functions returned ExprOk<string> (string-based types) and are no longer needed.
// The new approach uses:
//   1. ParseExpressionAST - builds AST (no types)
//   2. ResolveExpressionAST - resolves AST to SqlTypeShape
//
// This provides better separation of concerns and consistency with SELECT parsing.
// ============================================================================
