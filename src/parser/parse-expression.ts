import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type {
	PeekToken,
	SkipToken,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenParam,
	TokenString,
	TokensList,
} from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ParseParenEnclosedSelect, ParseParenScalarSelect } from "./parse-select.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"
import type { SkipBracketedUntil, SkipFailedExpression } from "./skip-statement.ts"

/** Caller-supplied `:name` bindings (names must match lexer param identifiers). */
export type ExpressionParamsShape = Record<string, { ts: unknown; sql: string }>

/** Default `Params` for parsers: `keyof` is `never` (plain `{}` widens against `Record<string, …>`). */
export type EmptyExpressionParams = Record<never, never>

/** Threaded through scalar parse for subqueries: catalog, `:param` bindings, outer aliases visible inside `(SELECT …)`. */
export type ExprParseEnv = {
	db: JsqlDatabaseShape
	params: ExpressionParamsShape
	outerScope: ScopeMap
}

/** True when `T` is `unknown` or `any` (not other types). */
export type IsUnknownOrAny<T> = 0 extends 1 & T ? true : unknown extends T ? (T extends unknown ? true : false) : false

export type ExprOk<Ts, Sql extends string> = { ok: true; ts: Ts; sql: Sql }

/** SQL `NULL` literal — may only appear in `IS [NOT] NULL`, not in `=` / `<>`. */
export type ExprSqlNull = { ok: true; ts: null; sql: "null"; exprKind: "sql_null" }

export type ExprAtom = ExprOk<unknown, string> | ExprSqlNull

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
type ParseSqlTypeName<Tokens extends TokensList, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<R1>, TokenKey<")">> extends [infer R2 extends TokensList, infer Rs]
					? Rs extends SqlParserError<string>
						? SkipFailedExpression<R2, Rs>
						: ParseSqlTypeName<SkipToken<R2>, readonly [...Acc, W]>
					: never
				: PeekToken<R1> extends TokenKey<".">
					? SkipToken<R1> extends infer R2 extends TokensList
						? ParseSqlTypeName<R2, readonly [...Acc, W]>
						: never
					: PeekToken<R1> extends TokenIdent<string>
						? ParseSqlTypeName<R1, readonly [...Acc, W]>
						: [R1, readonly [...Acc, W]]
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? Acc extends readonly []
				? SkipFailedExpression<Tokens, SqlParserError<"Expected type name">>
				: [Tokens, Acc]
			: Acc extends readonly []
				? SkipFailedExpression<Tokens, SqlParserError<"Expected type name">>
				: [Tokens, Acc]

/** True when `C` has exactly one own key (one projected column). */
type SingleProjectionColumn<C extends Record<string, unknown>> = keyof C extends infer A
	? A extends keyof C
		? { [B in keyof C]: B extends A ? 1 : 0 }[keyof C] extends 1
			? true
			: false
		: false
	: false

type ParseCastKeywordOperand<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? PeekToken<R0> extends TokenKey<"(">
				? SkipToken<R0> extends infer R1 extends TokensList
					? ParseOrScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer Inner]
						? Inner extends SqlParserError<string>
							? SkipFailedExpression<R2, Inner>
							: Inner extends ScalarExprAst
								? PeekToken<R2> extends TokenKey<"as">
									? SkipToken<R2> extends infer R3 extends TokensList
										? ParseSqlTypeName<R3, []> extends [infer R4 extends TokensList, infer Parts]
											? Parts extends SqlParserError<string>
												? SkipFailedExpression<R4, Parts>
												: Parts extends readonly []
													? SkipFailedExpression<
															R4,
															SqlParserError<"Expected type name after CAST ... AS">
														>
													: Parts extends readonly string[]
														? PeekToken<R4> extends infer TokCl
															? SkipToken<R4> extends infer R5 extends TokensList
																? TokCl extends TokenKey<")">
																	? [
																			R5,
																			{
																				kind: "sql_cast"
																				expr: Inner
																				type_parts: Parts
																			},
																		]
																	: [
																			R5,
																			SqlParserError<"Expected `)` after CAST type">,
																		]
																: never
															: never
														: never
											: never
										: never
									: SkipFailedExpression<R2, SqlParserError<"Expected AS in CAST">>
								: never
						: never
					: never
				: SkipFailedExpression<R0, SqlParserError<"Expected `(` after CAST">>
			: never
		: never

type ParsePgCastSuffixTail<Tokens extends TokensList, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"::">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseSqlTypeName<R0, []> extends [infer R1 extends TokensList, infer Parts]
				? Parts extends SqlParserError<string>
					? SkipFailedExpression<R1, Parts>
					: Parts extends readonly []
						? SkipFailedExpression<R1, SqlParserError<"Expected type name after ::">>
						: Parts extends readonly string[]
							? ParsePgCastSuffixTail<R1, { kind: "pg_cast"; expr: Acc; type_parts: Parts }>
							: never
				: never
			: never
		: [Tokens, Acc]

/** Additive / multiplicative / unary-minus / primary (no `AND`/`OR`/`NOT`/comparisons at this level). */
type ParseAddScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
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
	Tokens extends TokensList,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer E]
		? E extends SqlParserError<string>
			? SkipFailedExpression<R1, E>
			: E extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<")">
					? SkipToken<R1> extends infer R2 extends TokensList
						? [R2, readonly [...Acc, E]]
						: never
					: PeekToken<R1> extends TokenKey<",">
						? SkipToken<R1> extends infer R3 extends TokensList
							? ParseInListUntypedAccum<R3, readonly [...Acc, E], Env>
							: never
						: SkipFailedExpression<R1, SqlParserError<"Expected `,` or `)` in IN list">>
				: never
		: never

type DecParenDepth<T extends readonly unknown[]> = T extends readonly [...infer Rest, infer _Last] ? Rest : readonly []

/** Match the closing `)` of `( SELECT … )` when the subquery text starts at `Tokens` (leading `SELECT` token). */
type SkipParenWrappedSelectTail<Tokens extends TokensList, ExtraOpens extends readonly unknown[] = readonly []> =
	PeekToken<Tokens> extends TokenEot
		? SkipFailedExpression<Tokens, SqlParserError<"Unclosed subquery">>
		: PeekToken<Tokens> extends TokenKey<"(">
			? SkipParenWrappedSelectTail<SkipToken<Tokens>, readonly [...ExtraOpens, 0]>
			: PeekToken<Tokens> extends TokenKey<")">
				? [ExtraOpens] extends [readonly []]
					? [SkipToken<Tokens>, null]
					: SkipParenWrappedSelectTail<SkipToken<Tokens>, DecParenDepth<ExtraOpens>>
				: SkipParenWrappedSelectTail<SkipToken<Tokens>, ExtraOpens>

type ParseInListUntypedTail<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<")">
		? SkipFailedExpression<Tokens, SqlParserError<"IN list must not be empty">>
		: PeekToken<Tokens> extends TokenKey<"select">
			? ParseParenEnclosedSelect<Tokens, Env["db"], Env["params"], Env["outerScope"]> extends [
					infer R9 extends TokensList,
					infer Sub,
				]
				? Sub extends SqlParserError<string>
					? SkipFailedExpression<R9, Sub>
					: Sub extends JsqlSelectStatementResult
						? [R9, Sub]
						: never
				: never
			: ParseInListUntypedAccum<Tokens, readonly [], Env>

type ParseInListUntypedAfterInKw<Tokens extends TokensList, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"in">
		? SkipToken<Tokens> extends infer R8 extends TokensList
			? PeekToken<R8> extends TokenKey<"(">
				? ParseInListUntypedTail<SkipToken<R8>, Env> extends [infer R9 extends TokensList, infer ListRes]
					? ListRes extends SqlParserError<string>
						? SkipFailedExpression<R9, ListRes>
						: ListRes extends JsqlSelectStatementResult
							? [R9, { kind: "in_subquery"; expr: L; sub: ListRes }]
							: ListRes extends readonly ScalarExprAst[]
								? [R9, { kind: "in_list"; expr: L; items: ListRes }]
								: never
					: never
				: SkipFailedExpression<R8, SqlParserError<"Expected `(` after IN">>
			: never
		: never

type ParseBetweenAfterL<Tokens extends TokensList, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"between">
		? SkipToken<Tokens> extends infer Rb extends TokensList
			? ParseAddScalarUntyped<Rb, Env> extends [infer Rlow extends TokensList, infer Low]
				? Low extends SqlParserError<string>
					? SkipFailedExpression<Rlow, Low>
					: PeekToken<Rlow> extends TokenKey<"and">
						? SkipToken<Rlow> extends infer Ra extends TokensList
							? ParseOtherOpScalarUntyped<Ra, Env> extends [infer Rh extends TokensList, infer High]
								? High extends SqlParserError<string>
									? SkipFailedExpression<Rh, High>
									: [Rh, { kind: "between"; expr: L; low: Low; high: High }]
								: never
							: never
						: SkipFailedExpression<Rlow, SqlParserError<"Expected AND between BETWEEN bounds">>
				: never
			: never
		: never

type ParseLikeAfterL<Tokens extends TokensList, L extends ScalarExprAst, CI extends boolean, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer TokKw
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? TokKw extends TokenKey<"like"> | TokenKey<"ilike">
				? ParseOtherOpScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer Pat]
					? Pat extends SqlParserError<string>
						? SkipFailedExpression<R2, Pat>
						: [R2, { kind: "like"; expr: L; pattern: Pat; case_insensitive: CI }]
					: never
				: never
			: never
		: never

type ParseCaseExpectEndKeyword<
	Tokens extends TokensList,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Disc extends ScalarExprAst | null,
> =
	PeekToken<Tokens> extends TokenKey<"end">
		? SkipToken<Tokens> extends infer Rend extends TokensList
			? Acc extends readonly []
				? SkipFailedExpression<Rend, SqlParserError<"CASE requires at least one WHEN">>
				: Disc extends null
					? [Rend, { kind: "case_searched"; arms: Acc; else_: ElseB }]
					: [Rend, { kind: "case_simple"; discriminant: Disc; arms: Acc; else_: ElseB }]
			: never
		: SkipFailedExpression<Tokens, SqlParserError<"Expected END after CASE">>

type ParseCaseAfterOneArm<
	Tokens extends TokensList,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, Acc, Disc, Env>
		: PeekToken<Tokens> extends TokenKey<"else">
			? SkipToken<Tokens> extends infer Re extends TokensList
				? ParseOrScalarUntyped<Re, Env> extends [infer Rel extends TokensList, infer Ea]
					? Ea extends SqlParserError<string>
						? SkipFailedExpression<Rel, Ea>
						: Ea extends ScalarExprAst
							? ParseCaseExpectEndKeyword<Rel, Acc, Ea, Disc>
							: never
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"end">
				? ParseCaseExpectEndKeyword<Tokens, Acc, null, Disc>
				: SkipFailedExpression<Tokens, SqlParserError<"Expected WHEN ELSE or END in CASE">>

type ParseCaseWhenArmsThenElseEnd<
	Tokens extends TokensList,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? SkipToken<Tokens> extends infer Rw extends TokensList
			? ParseOrScalarUntyped<Rw, Env> extends [infer Rcond extends TokensList, infer Wast]
				? Wast extends SqlParserError<string>
					? SkipFailedExpression<Rcond, Wast>
					: Wast extends ScalarExprAst
						? PeekToken<Rcond> extends TokenKey<"then">
							? SkipToken<Rcond> extends infer Rt extends TokensList
								? ParseOrScalarUntyped<Rt, Env> extends [infer Rth extends TokensList, infer Thast]
									? Thast extends SqlParserError<string>
										? SkipFailedExpression<Rth, Thast>
										: Thast extends ScalarExprAst
											? ParseCaseAfterOneArm<
													Rth,
													readonly [...Acc, { when: Wast; then: Thast }],
													Disc,
													Env
												>
											: never
									: never
								: never
							: SkipFailedExpression<Rcond, SqlParserError<"Expected THEN after CASE WHEN">>
						: never
				: never
			: never
		: never

/** After `CASE` keyword: searched `CASE WHEN` or simple `CASE expr WHEN`. */
type ParseCaseAfterCaseKw<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, readonly [], null, Env>
		: ParseOrScalarUntyped<Tokens, Env> extends [infer Rd extends TokensList, infer Dast]
			? Dast extends SqlParserError<string>
				? SkipFailedExpression<Rd, Dast>
				: Dast extends ScalarExprAst
					? PeekToken<Rd> extends TokenKey<"when">
						? ParseCaseWhenArmsThenElseEnd<Rd, readonly [], Dast, Env>
						: SkipFailedExpression<Rd, SqlParserError<"Expected WHEN after CASE expression">>
					: never
			: never

type ParseAfterIsUntyped<Tokens extends TokensList, L extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R5 extends TokensList
			? PeekToken<R5> extends TokenKey<"null">
				? SkipToken<R5> extends infer R6 extends TokensList
					? [R6, { kind: "is_not_null"; expr: L }]
					: never
				: SkipFailedExpression<R5, SqlParserError<"Expected NULL after IS NOT">>
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? SkipToken<Tokens> extends infer R7 extends TokensList
				? [R7, { kind: "is_null"; expr: L }]
				: never
			: SkipFailedExpression<Tokens, SqlParserError<"Expected NULL after IS">>

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

type ParseAnyAllSomeAfterOp<Tokens extends TokensList, L extends ScalarExprAst, OpToken, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer Kw
		? Kw extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
			? SkipToken<Tokens> extends infer R1 extends TokensList
				? PeekToken<R1> extends TokenKey<"(">
					? SkipToken<R1> extends infer R2 extends TokensList
						? PeekToken<R2> extends TokenKey<"select">
							? ParseParenEnclosedSelect<R2, Env["db"], Env["params"], Env["outerScope"]> extends [
									infer R3 extends TokensList,
									infer Sub,
								]
								? Sub extends SqlParserError<string>
									? SkipFailedExpression<R3, Sub>
									: Sub extends JsqlSelectStatementResult
										? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
											? Kw extends TokenKey<"any">
												? [R3, { kind: "any_op"; op: Op; left: L; right: Sub }]
												: Kw extends TokenKey<"all">
													? [R3, { kind: "all_op"; op: Op; left: L; right: Sub }]
													: Kw extends TokenKey<"some">
														? [R3, { kind: "some_op"; op: Op; left: L; right: Sub }]
														: never
											: SkipFailedExpression<R3, SqlParserError<"Invalid comparison operator">>
										: never
								: never
							: ParseOrScalarUntyped<R2, Env> extends [infer R4 extends TokensList, infer ArrExpr]
								? ArrExpr extends SqlParserError<string>
									? SkipFailedExpression<R4, ArrExpr>
									: ArrExpr extends ScalarExprAst
										? PeekToken<R4> extends TokenKey<")">
											? SkipToken<R4> extends infer R5 extends TokensList
												? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
													? Kw extends TokenKey<"any">
														? [R5, { kind: "any_op"; op: Op; left: L; right: ArrExpr }]
														: Kw extends TokenKey<"all">
															? [R5, { kind: "all_op"; op: Op; left: L; right: ArrExpr }]
															: Kw extends TokenKey<"some">
																? [
																		R5,
																		{
																			kind: "some_op"
																			op: Op
																			left: L
																			right: ArrExpr
																		},
																	]
																: never
													: SkipFailedExpression<
															R5,
															SqlParserError<"Invalid comparison operator">
														>
												: never
											: SkipFailedExpression<
													R4,
													SqlParserError<"Expected ) after ANY/ALL/SOME expression">
												>
										: never
								: never
						: never
					: SkipFailedExpression<R1, SqlParserError<"Expected ( after ANY/ALL/SOME">>
				: never
			: never
		: never

type ParseAfterAddScalarRelIsInUntyped<Tokens extends TokensList, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer P
		? IsRelOp<P> extends true
			? SkipToken<Tokens> extends infer R2 extends TokensList
				? PeekToken<R2> extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
					? ParseAnyAllSomeAfterOp<R2, L, P, Env>
					: ParseOtherOpScalarUntyped<R2, Env> extends [infer R3 extends TokensList, infer Rhs]
						? Rhs extends SqlParserError<string>
							? SkipFailedExpression<R3, Rhs>
							: TokenToCmpOp<P> extends infer Cop extends ScalarCmpOp
								? [R3, { kind: "cmp"; op: Cop; left: L; right: Rhs }]
								: SkipFailedExpression<R3, SqlParserError<"Invalid comparison operator">>
						: never
				: never
			: P extends TokenKey<"is">
				? SkipToken<Tokens> extends infer R4 extends TokensList
					? ParseAfterIsUntyped<R4, L>
					: never
				: P extends TokenKey<"in">
					? ParseInListUntypedAfterInKw<Tokens, L, Env>
					: P extends TokenKey<"between">
						? ParseBetweenAfterL<Tokens, L, Env>
						: P extends TokenKey<"~">
							? SkipToken<Tokens> extends infer Rregex extends TokensList
								? ParseOtherOpScalarUntyped<Rregex, Env> extends [
										infer Rrp extends TokensList,
										infer Pat,
									]
									? Pat extends SqlParserError<string>
										? SkipFailedExpression<Rrp, Pat>
										: [
												Rrp,
												{
													kind: "pg_regex_match"
													expr: L
													pattern: Pat
													case_insensitive: false
												},
											]
									: never
								: never
							: P extends TokenKey<"~*">
								? SkipToken<Tokens> extends infer Rregexi extends TokensList
									? ParseOtherOpScalarUntyped<Rregexi, Env> extends [
											infer Rrpi extends TokensList,
											infer Pati,
										]
										? Pati extends SqlParserError<string>
											? SkipFailedExpression<Rrpi, Pati>
											: [
													Rrpi,
													{
														kind: "pg_regex_match"
														expr: L
														pattern: Pati
														case_insensitive: true
													},
												]
										: never
									: never
								: P extends TokenKey<"!~">
									? SkipToken<Tokens> extends infer Rnotregex extends TokensList
										? ParseOtherOpScalarUntyped<Rnotregex, Env> extends [
												infer Rrpn extends TokensList,
												infer Patn,
											]
											? Patn extends SqlParserError<string>
												? SkipFailedExpression<Rrpn, Patn>
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
													]
											: never
										: never
									: P extends TokenKey<"!~*">
										? SkipToken<Tokens> extends infer Rnotregexi extends TokensList
											? ParseOtherOpScalarUntyped<Rnotregexi, Env> extends [
													infer Rrpni extends TokensList,
													infer Patni,
												]
												? Patni extends SqlParserError<string>
													? SkipFailedExpression<Rrpni, Patni>
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
														]
												: never
											: never
										: P extends TokenKey<"like">
											? ParseLikeAfterL<Tokens, L, false, Env>
											: P extends TokenKey<"ilike">
												? ParseLikeAfterL<Tokens, L, true, Env>
												: [Tokens, L]
		: never

type ParseRelScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer E1]
		? E1 extends SqlParserError<string>
			? SkipFailedExpression<R1, E1>
			: E1 extends ScalarExprAst
				? ParseAfterAddScalarRelIsInUntyped<R1, E1, Env>
				: never
		: never

type ParseNotScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"exists">
		? SkipToken<Tokens> extends infer Rex0 extends TokensList
			? PeekToken<Rex0> extends TokenKey<"(">
				? SkipToken<Rex0> extends infer Rex1 extends TokensList
					? PeekToken<Rex1> extends TokenKey<"select">
						? ParseParenEnclosedSelect<Rex1, Env["db"], Env["params"], Env["outerScope"]> extends [
								infer Rex2 extends TokensList,
								infer Sub,
							]
							? Sub extends SqlParserError<string>
								? SkipFailedExpression<Rex2, Sub>
								: Sub extends JsqlSelectStatementResult
									? [Rex2, { kind: "exists_subquery"; sub: Sub }]
									: never
							: never
						: SkipFailedExpression<Rex1, SqlParserError<"Expected SELECT in EXISTS subquery">>
					: never
				: SkipFailedExpression<Rex0, SqlParserError<"Expected `(` after EXISTS">>
			: never
		: PeekToken<Tokens> extends TokenKey<"not">
			? SkipToken<Tokens> extends infer Rn extends TokensList
				? ParseNotScalarUntyped<Rn, Env> extends [infer Ru extends TokensList, infer U]
					? U extends SqlParserError<string>
						? SkipFailedExpression<Ru, U>
						: U extends ScalarExprAst
							? [Ru, { kind: "not"; inner: U }]
							: never
					: never
				: never
			: ParseRelScalarUntyped<Tokens, Env>

type ParseAndLoopScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"and">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseNotScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? ParseAndLoopScalarUntyped<R2, { kind: "and"; left: Acc; right: E1 }, Env>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseAndScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseNotScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ParseAndLoopScalarUntyped<R0, E0, Env>
				: never
		: never

type ParseOrLoopScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"or">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseAndScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? ParseOrLoopScalarUntyped<R2, { kind: "or"; left: Acc; right: E1 }, Env>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseOrScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseAndScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ParseOrLoopScalarUntyped<R0, E0, Env>
				: never
		: never

type ResolveFunctionArgsList<
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Acc extends readonly ExprAtom[] = [],
> = Args extends readonly [infer First, ...infer Rest extends readonly (ScalarExprAst | { kind: "star" })[]]
	? First extends { kind: "star" }
		? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, ExprOk<unknown, "unknown">]>
		: First extends ScalarExprAst
			? ResolveExpressionAST<First, Db, Scope, Params> extends infer Res
				? Res extends SqlParserError<string>
					? Res
					: Res extends ExprAtom
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
				? ArgsRes extends SqlParserError<string>
					? ArgsRes
					: ArgsRes extends readonly ExprAtom[]
						? ExprOk<number, "bigint">
						: never
				: never
			: SqlParserError<"`*` is only allowed as COUNT(*) argument">
		: ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
			? ArgsRes extends SqlParserError<string>
				? ArgsRes
				: ArgsRes extends readonly ExprAtom[]
					? L extends "count"
						? ExprOk<number, "bigint">
						: L extends "lower" | "upper"
							? ArgsRes extends readonly [ExprOk<string, infer _S>, ...infer _Rest]
								? ExprOk<string, "text">
								: ArgsRes extends readonly []
									? SqlParserError<"Function requires at least one argument">
									: SqlParserError<"Function expects text argument">
							: L extends "coalesce"
								? ArgsRes extends readonly []
									? SqlParserError<"coalesce() requires at least one argument">
									: ArgsRes[0] extends ExprOk<infer T0, infer S0>
										? ExprOk<T0, S0>
										: ExprOk<unknown, "unknown">
								: L extends "now"
									? ArgsRes extends readonly []
										? ExprOk<Date, "timestamp with time zone">
										: SqlParserError<"now() takes no arguments">
									: L extends "sum"
										? ArgsRes extends readonly [ExprAtom, ...infer _R]
											? ExprOk<number, "numeric">
											: SqlParserError<"sum() requires an argument">
										: L extends "uuid_generate_v4" | "gen_random_uuid"
											? ArgsRes extends readonly []
												? ExprOk<string, "uuid">
												: SqlParserError<"This function takes no arguments">
											: L extends "array_length"
												? ArgsRes extends readonly [
														ExprOk<infer _T1, infer S1>,
														ExprOk<number, infer _S2>,
													]
													? S1 extends `${string}[]` | "unknown"
														? ExprOk<number, "integer">
														: SqlParserError<"array_length expects (array, integer)">
													: SqlParserError<"array_length requires 2 arguments">
												: L extends "array_append"
													? ArgsRes extends readonly [ExprOk<infer _T1, infer S1>, ExprAtom]
														? S1 extends `${string}[]` | "unknown"
															? ExprOk<readonly unknown[], "unknown">
															: SqlParserError<"array_append expects (array, element)">
														: SqlParserError<"array_append requires 2 arguments">
													: L extends "array_prepend"
														? ArgsRes extends readonly [
																ExprAtom,
																ExprOk<infer _T2, infer S2>,
															]
															? S2 extends `${string}[]` | "unknown"
																? ExprOk<readonly unknown[], "unknown">
																: SqlParserError<"array_prepend expects (element, array)">
															: SqlParserError<"array_prepend requires 2 arguments">
														: L extends "unnest"
															? ArgsRes extends readonly [ExprOk<infer _T1, infer S1>]
																? S1 extends `${string}[]` | "unknown"
																	? ExprOk<unknown, "unknown">
																	: SqlParserError<"unnest expects an array">
																: SqlParserError<"unnest requires 1 argument">
															: "functions" extends keyof Db
																? Db["functions"] extends Record<string, unknown>
																	? L extends keyof Db["functions"]
																		? Db["functions"][L &
																				keyof Db["functions"]] extends infer SqlType extends
																				string
																			? ExprOk<unknown, SqlType>
																			: ExprOk<unknown, "unknown">
																		: SqlParserError<`Unknown function: ${Name}`>
																	: SqlParserError<`Unknown function: ${Name}`>
																: SqlParserError<`Unknown function: ${Name}`>
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
		? ExprOk<number, "bigint">
		: SqlParserError<"ROW_NUMBER() takes no arguments">
	: L extends "rank" | "dense_rank"
		? Args extends readonly []
			? ExprOk<number, "bigint">
			: SqlParserError<"RANK/DENSE_RANK takes no arguments">
		: L extends "lag" | "lead"
			? ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
				? ArgsRes extends SqlParserError<string>
					? ArgsRes
					: ArgsRes extends readonly [ExprOk<infer T, infer S>, ...infer _Rest]
						? ExprOk<T | null, S>
						: ArgsRes extends readonly []
							? SqlParserError<"LAG/LEAD requires at least 1 argument">
							: SqlParserError<"Invalid LAG/LEAD arguments">
				: never
			: SqlParserError<"Unknown window function">

type ResolveCustomOp<
	Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends SqlParserError<string>
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends SqlParserError<string>
					? Rv
					: Lv extends ExprAtom
						? Rv extends ExprAtom
							? Op extends "@>" | "&&" | "<@"
								? ExprOk<boolean, "boolean">
								: Op extends "||"
									? Lv extends ExprOk<infer _Lval, infer LvSql extends string>
										? LvSql extends `${infer ElemType}[]`
											? Rv extends ExprOk<infer _Rval, "text">
												? SqlParserError<"Cannot concatenate array with text">
												: Rv extends ExprOk<infer _Rval, infer RvSql extends string>
													? RvSql extends ElemType
														? ExprOk<readonly unknown[], LvSql>
														: RvSql extends `${string}[]`
															? ExprOk<readonly unknown[], LvSql>
															: SqlParserError<`Cannot concatenate ${LvSql} with ${RvSql}`>
													: never
											: Rv extends ExprOk<infer _Rval, infer RvSql extends string>
												? RvSql extends `${infer ElemType}[]`
													? LvSql extends "text"
														? SqlParserError<"Cannot concatenate text with array">
														: LvSql extends ElemType
															? ExprOk<readonly unknown[], RvSql>
															: SqlParserError<`Cannot concatenate ${LvSql} with ${RvSql}`>
													: LvSql extends "text"
														? RvSql extends
																| "text"
																| "integer"
																| "bigint"
																| "numeric"
																| "uuid"
																| "boolean"
															? ExprOk<string, "text">
															: SqlParserError<`Cannot concatenate text with ${RvSql}`>
														: RvSql extends "text"
															? LvSql extends
																	| "integer"
																	| "bigint"
																	| "numeric"
																	| "uuid"
																	| "boolean"
																? ExprOk<string, "text">
																: SqlParserError<`Cannot concatenate ${LvSql} with text`>
															: SqlParserError<"|| requires at least one text operand">
												: never
										: never
									: ExprOk<unknown, string>
							: SqlParserError<"Invalid custom operator operand">
						: SqlParserError<"Invalid custom operator operand">
				: never
		: never

type ResolveArrayCtorElements<
	Els extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	AccTypes extends readonly string[] = readonly [],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer V
		? V extends SqlParserError<string>
			? V
			: V extends ExprOk<infer _Val, infer SqlType extends string>
				? ResolveArrayCtorElements<R, Db, Scope, Params, readonly [...AccTypes, SqlType]>
				: SqlParserError<"Invalid ARRAY element">
		: never
	: InferArrayType<AccTypes>

type InferArrayType<Types extends readonly string[]> = Types extends readonly []
	? SqlParserError<"Cannot determine type of empty array">
	: Types extends readonly [infer First extends string, ...infer Rest extends readonly string[]]
		? UnifyArrayElementTypes<First, Rest> extends infer Unified extends string
			? ExprOk<readonly unknown[], `${Unified}[]`>
			: never
		: never

type UnifyArrayElementTypes<First extends string, Rest extends readonly string[]> = Rest extends readonly []
	? First
	: Rest extends readonly [infer Next extends string, ...infer Tail extends readonly string[]]
		? First extends Next
			? UnifyArrayElementTypes<First, Tail>
			: Next extends First
				? UnifyArrayElementTypes<Next, Tail>
				: "unknown"
		: never

// Parse expression to AST to be resolved later when `FROM` scope is known (`OR` … `AND` … `NOT` … comparisons … arithmetic).

export type ParseExpressionAST<Tokens extends TokensList, Env extends ExprParseEnv> = ParseOrScalarUntyped<Tokens, Env>

/** Resolve after `FROM` scope is known */
type ExpressionResolvers<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = {
	true: ExprOk<true, "boolean">
	false: ExprOk<false, "boolean">
	sql_null: ExprSqlNull
	string: Ast extends { kind: "string"; value: string } ? ExprOk<string, "text"> : never
	number: Ast extends { kind: "number"; raw: string } ? ExprOk<number, "integer"> : never
	param: Ast extends { kind: "param"; name: infer N extends string } ? LookupParam<Params, N> : never
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
	qualified_table_star: SqlParserError<"Qualified table .* is only valid in SELECT lists">
	alias_table_star: SqlParserError<"Qualified table .* is only valid in SELECT lists">
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
			? Lv extends SqlParserError<string>
				? Lv
				: ResolveExpressionAST<I, Db, Scope, Params> extends infer Rv
					? Rv extends SqlParserError<string>
						? Rv
						: Lv extends ExprAtom
							? Rv extends ExprAtom
								? ExprOk<unknown, "unknown">
								: SqlParserError<"Invalid array subscript operand">
							: SqlParserError<"Invalid array base operand">
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
				? MergeBoolBinary<Lv, Rv, "AND operands must be boolean">
				: never
			: never
		: never
	or: Ast extends { kind: "or"; left: infer Lo extends ScalarExprAst; right: infer Ro extends ScalarExprAst }
		? ResolveExpressionAST<Lo, Db, Scope, Params> extends infer Lv2
			? ResolveExpressionAST<Ro, Db, Scope, Params> extends infer Rv2
				? MergeBoolBinary<Lv2, Rv2, "OR operands must be boolean">
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
				? LcV extends SqlParserError<string>
					? LcV
					: RcV extends SqlParserError<string>
						? RcV
						: LcV extends ExprAtom
							? RcV extends ExprAtom
								? MergeComparison<LcV, RcV>
								: SqlParserError<"Invalid comparison operand">
							: SqlParserError<"Invalid comparison operand">
				: never
			: never
		: never
	is_null: Ast extends { kind: "is_null"; expr: infer E0 extends ScalarExprAst }
		? ResolveExpressionAST<E0, Db, Scope, Params> extends infer V0
			? V0 extends SqlParserError<string>
				? V0
				: V0 extends ExprSqlNull
					? ExprOk<true, "boolean">
					: V0 extends ExprOk<unknown, string>
						? ExprOk<false, "boolean">
						: SqlParserError<"Invalid IS NULL operand">
			: never
		: never
	is_not_null: Ast extends { kind: "is_not_null"; expr: infer E1 extends ScalarExprAst }
		? ResolveExpressionAST<E1, Db, Scope, Params> extends infer V1
			? V1 extends SqlParserError<string>
				? V1
				: V1 extends ExprSqlNull
					? ExprOk<false, "boolean">
					: V1 extends ExprOk<unknown, string>
						? ExprOk<true, "boolean">
						: SqlParserError<"Invalid IS NOT NULL operand">
			: never
		: never
	pg_cast: Ast extends {
		kind: "pg_cast"
		expr: infer Exc extends ScalarExprAst
		type_parts: infer Ptc extends readonly string[]
	}
		? ResolveExpressionAST<Exc, Db, Scope, Params> extends infer Evc
			? Evc extends SqlParserError<string>
				? Evc
				: Evc extends ExprAtom
					? SqlCastTypeNorm<Ptc> extends infer Normc extends string
						? ResolveCastFromAtom<Evc, Normc>
						: SqlParserError<"Invalid cast target">
					: SqlParserError<"Invalid cast operand">
			: never
		: never
	sql_cast: Ast extends {
		kind: "sql_cast"
		expr: infer Exs extends ScalarExprAst
		type_parts: infer Pts extends readonly string[]
	}
		? ResolveExpressionAST<Exs, Db, Scope, Params> extends infer Evs
			? Evs extends SqlParserError<string>
				? Evs
				: Evs extends ExprAtom
					? SqlCastTypeNorm<Pts> extends infer Norms extends string
						? ResolveCastFromAtom<Evs, Norms>
						: SqlParserError<"Invalid cast target">
					: SqlParserError<"Invalid cast operand">
			: never
		: never
	between: Ast extends {
		kind: "between"
		expr: infer Eb extends ScalarExprAst
		low: infer Lb extends ScalarExprAst
		high: infer Hb extends ScalarExprAst
	}
		? ResolveExpressionAST<Eb, Db, Scope, Params> extends infer EvB
			? EvB extends SqlParserError<string>
				? EvB
				: ResolveExpressionAST<Lb, Db, Scope, Params> extends infer LvB
					? LvB extends SqlParserError<string>
						? LvB
						: ResolveExpressionAST<Hb, Db, Scope, Params> extends infer HvB
							? HvB extends SqlParserError<string>
								? HvB
								: EvB extends ExprAtom
									? LvB extends ExprAtom
										? HvB extends ExprAtom
											? MergeBetweenBounds<EvB, LvB, HvB>
											: SqlParserError<"Invalid BETWEEN bound">
										: SqlParserError<"Invalid BETWEEN bound">
									: SqlParserError<"Invalid BETWEEN operand">
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
			? EvL extends SqlParserError<string>
				? EvL
				: ResolveExpressionAST<Pl, Db, Scope, Params> extends infer PvL
					? PvL extends SqlParserError<string>
						? PvL
						: EvL extends ExprAtom
							? PvL extends ExprAtom
								? MergeLikeOperands<EvL, PvL>
								: SqlParserError<"Invalid LIKE pattern">
							: SqlParserError<"Invalid LIKE operand">
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
			? EvR extends SqlParserError<string>
				? EvR
				: ResolveExpressionAST<Pr, Db, Scope, Params> extends infer PvR
					? PvR extends SqlParserError<string>
						? PvR
						: EvR extends ExprAtom
							? PvR extends ExprAtom
								? MergeLikeOperands<EvR, PvR>
								: SqlParserError<"Invalid ~ pattern">
							: SqlParserError<"Invalid ~ operand">
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
		? ExprOk<boolean, "boolean">
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
			? LvIn extends SqlParserError<string>
				? LvIn
				: LvIn extends ExprAtom
					? ResolveInListItemsAgainstLeft<LvIn, Ins, Db, Scope, Params>
					: SqlParserError<"Invalid IN left operand">
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
	: SqlParserError<"Invalid scalar expression">

/** Longest `a` / `a.b` / `a.b.c` chain starting at an identifier (used by SELECT list fast path).
 * Also recognizes `alias.*` and `schema.table.*` via sentinel tuples `["__ats__", alias]` / `["__qts__", sch, tab]`.
 */
type MaximalIdentChain<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends TokensList
					? PeekToken<R2> extends TokenKey<"*">
						? SkipToken<R2> extends infer R3 extends TokensList
							? [R3, readonly ["__ats__", A]]
							: never
						: PeekToken<R2> extends TokenIdent<infer B extends string>
							? SkipToken<R2> extends infer R3 extends TokensList
								? PeekToken<R3> extends TokenKey<".">
									? SkipToken<R3> extends infer R4 extends TokensList
										? PeekToken<R4> extends TokenKey<"*">
											? SkipToken<R4> extends infer R5 extends TokensList
												? [R5, readonly ["__qts__", A, B]]
												: never
											: PeekToken<R4> extends TokenIdent<infer C extends string>
												? SkipToken<R4> extends infer R5 extends TokensList
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
	? IsUnknownOrAny<Params[Name]["ts"]> extends true
		? SqlParserError<"Parameter has unknown or any type">
		: ExprOk<Params[Name]["ts"], Params[Name]["sql"]>
	: SqlParserError<"Unknown query parameter">

type ResolveIdentChainValue<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> =
	ResolveColumnRefValue<Db, Scope, Parts> extends infer V
		? V extends SqlParserError<string>
			? V
			: V extends { ts: infer Ts; sql: infer Sql extends string }
				? ExprOk<Ts, Sql>
				: SqlParserError<"Invalid column reference">
		: never

type TryOperandIdentColumnRefBody<
	Rm extends TokensList,
	Parts extends readonly string[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
> = Parts extends readonly [infer S extends string, infer T extends string, infer C extends string]
	? ResolveIdentChainValue<Db, Scope, readonly [S, T, C]> extends infer V
		? V extends SqlParserError<string>
			? SkipFailedExpression<Rm, V>
			: V extends ExprOk<infer Ts, infer Sql extends string>
				? [Rm, V]
				: never
		: never
	: Parts extends readonly [infer A extends string, infer C2 extends string]
		? ResolveIdentChainValue<Db, Scope, readonly [A, C2]> extends infer V2
			? V2 extends SqlParserError<string>
				? SkipFailedExpression<Rm, V2>
				: V2 extends ExprOk<infer Ts2, infer Sql2 extends string>
					? [Rm, V2]
					: never
			: never
		: Parts extends readonly [infer C1 extends string]
			? ResolveIdentChainValue<Db, Scope, readonly [C1]> extends infer V1
				? V1 extends SqlParserError<string>
					? SkipFailedExpression<Rm, V1>
					: V1 extends ExprOk<infer Ts1, infer Sql1 extends string>
						? [Rm, V1]
						: never
				: never
			: never

type ParseFunctionArgsAccum<
	Tokens extends TokensList,
	Env extends ExprParseEnv,
	Acc extends readonly (ScalarExprAst | { kind: "star" })[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Acc]
		: ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer E]
			? E extends SqlParserError<string>
				? SkipFailedExpression<R1, E>
				: E extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, E]]
						: PeekToken<R1> extends TokenKey<",">
							? ParseFunctionArgsAccum<SkipToken<R1>, Env, readonly [...Acc, E]>
							: SkipFailedExpression<R1, SqlParserError<"Expected `,` or `)` in argument list">>
					: never
			: never

type ParseFunctionArgs<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"*">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<")">
				? [SkipToken<R1>, readonly [{ kind: "star" }]]
				: SkipFailedExpression<R1, SqlParserError<"Expected `)` after `*`">>
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? [SkipToken<Tokens>, readonly []]
			: ParseFunctionArgsAccum<Tokens, Env, readonly []>

type ParseOptionalOverClause<
	Tokens extends TokensList,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"over">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"(">
				? SkipToken<R1> extends infer R2 extends TokensList
					? ParseWindowClauseContent<R2, FnName, Args, Env>
					: never
				: SkipFailedExpression<R1, SqlParserError<"Expected ( after OVER">>
			: never
		: [Tokens, { kind: "function_call"; name: FnName; args: Args }]

type ParseWindowClauseContent<
	Tokens extends TokensList,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"partition">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"by">
				? ParseWindowPartitionByList<SkipToken<R1>, Env> extends [
						infer R2 extends TokensList,
						infer PartitionList,
					]
					? PartitionList extends SqlParserError<string>
						? SkipFailedExpression<R2, PartitionList>
						: PartitionList extends readonly ScalarExprAst[]
							? PeekToken<R2> extends TokenKey<"order">
								? ParseWindowOrderByAfterPartition<R2, FnName, Args, PartitionList, Env>
								: PeekToken<R2> extends TokenKey<")">
									? [
											SkipToken<R2>,
											{
												kind: "window_function"
												name: FnName
												args: Args
												over: { partition_by: PartitionList; order_by: readonly [] }
											},
										]
									: SkipFailedExpression<
											R2,
											SqlParserError<"Expected ORDER BY or ) after PARTITION BY">
										>
							: never
					: never
				: SkipFailedExpression<R1, SqlParserError<"Expected BY after PARTITION">>
			: never
		: PeekToken<Tokens> extends TokenKey<"order">
			? ParseWindowOrderByWithoutPartition<Tokens, FnName, Args, Env>
			: SkipFailedExpression<Tokens, SqlParserError<"Expected PARTITION BY or ORDER BY in OVER clause">>

type ParseWindowOrderByWithoutPartition<
	Tokens extends TokensList,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends TokensList
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [infer R4 extends TokensList, infer OrderList]
				? OrderList extends SqlParserError<string>
					? SkipFailedExpression<R4, OrderList>
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
								]
							: SkipFailedExpression<R4, SqlParserError<"Expected ) after OVER clause">>
						: never
				: never
			: SkipFailedExpression<R3, SqlParserError<"Expected BY after ORDER in OVER clause">>
		: never

type ParseWindowOrderByAfterPartition<
	Tokens extends TokensList,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	PartitionList extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends TokensList
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [infer R4 extends TokensList, infer OrderList]
				? OrderList extends SqlParserError<string>
					? SkipFailedExpression<R4, OrderList>
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
								]
							: SkipFailedExpression<R4, SqlParserError<"Expected ) after OVER clause">>
						: never
				: never
			: SkipFailedExpression<R3, SqlParserError<"Expected BY after ORDER">>
		: never

type ParseWindowPartitionByList<
	Tokens extends TokensList,
	Env extends ExprParseEnv,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer Expr]
		? Expr extends SqlParserError<string>
			? SkipFailedExpression<R1, Expr>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<",">
					? ParseWindowPartitionByList<SkipToken<R1>, Env, readonly [...Acc, Expr]>
					: [R1, readonly [...Acc, Expr]]
				: never
		: never

type ParseWindowOrderByList<
	Tokens extends TokensList,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer Expr]
		? Expr extends SqlParserError<string>
			? SkipFailedExpression<R1, Expr>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<"asc">
					? ParseWindowOrderByListTail<
							SkipToken<R1>,
							Env,
							readonly [...Acc, { expr: Expr; direction: "asc" }]
						>
					: PeekToken<R1> extends TokenKey<"desc">
						? ParseWindowOrderByListTail<
								SkipToken<R1>,
								Env,
								readonly [...Acc, { expr: Expr; direction: "desc" }]
							>
						: ParseWindowOrderByListTail<R1, Env, readonly [...Acc, { expr: Expr; direction: null }]>
				: never
		: never

type ParseWindowOrderByListTail<
	Tokens extends TokensList,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[],
> = PeekToken<Tokens> extends TokenKey<","> ? ParseWindowOrderByList<SkipToken<Tokens>, Env, Acc> : [Tokens, Acc]

type TryOperandIdentOrCall<Tokens extends TokensList, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends TokensList, infer Parts]
		? Parts extends readonly ["__ats__", string] | readonly ["__qts__", string, string]
			? SkipFailedExpression<Rm, SqlParserError<"Qualified table .* is only valid in SELECT lists">>
			: PeekToken<Rm> extends TokenKey<"(">
				? ParseFunctionArgs<SkipToken<Rm>, Env> extends [infer After extends TokensList, infer Args]
					? Args extends SqlParserError<string>
						? SkipFailedExpression<After, Args>
						: Args extends readonly (ScalarExprAst | { kind: "star" })[]
							? Parts extends readonly [infer FnName extends string]
								? ParseOptionalOverClause<After, FnName, Args, Env>
								: SkipFailedExpression<
										After,
										SqlParserError<"Qualified function names are not supported">
									>
							: never
					: never
				: Parts extends ScalarIdentParts
					? TryOperandIdentColumnRefBody<Rm, Parts, Env["db"], Env["outerScope"]>
					: never
		: never

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

type IsSqlNumericType<Sql extends string> = SqlComparisonClass<Sql> extends "numeric" ? true : false
type IsSqlBooleanType<Sql extends string> = SqlComparisonClass<Sql> extends "boolean" ? true : false
type IsSqlTextType<Sql extends string> = SqlComparisonClass<Sql> extends "text" ? true : false

export type SameComparisonClass<SqlL extends string, SqlR extends string> =
	SqlComparisonClass<SqlL> extends "unknown"
		? true
		: SqlComparisonClass<SqlR> extends "unknown"
			? true
			: SqlComparisonClass<SqlL> extends SqlComparisonClass<SqlR>
				? true
				: false

type MergeComparison<L extends ExprAtom, R extends ExprAtom> = L extends ExprSqlNull
	? SqlParserError<"Use IS NULL instead of = null">
	: R extends ExprSqlNull
		? SqlParserError<"Use IS NULL instead of = null">
		: L extends ExprOk<infer _TsL, infer Sl extends string>
			? R extends ExprOk<infer _TsR, infer Sr extends string>
				? SameComparisonClass<Sl, Sr> extends true
					? ExprOk<boolean, "boolean">
					: SqlParserError<"Incompatible types in comparison">
				: never
			: never

/** Simple `CASE expr WHEN value` — each `value` must be `=`-compatible with `expr` (same errors as comparisons). */
type ValidateCaseSimpleWhenMatch<Disc extends ExprAtom, WhenV extends ExprAtom> =
	MergeComparison<Disc, WhenV> extends SqlParserError<infer M> ? SqlParserError<M> : true

type MergeBetweenBounds<E extends ExprAtom, Lm extends ExprAtom, H extends ExprAtom> = E extends ExprSqlNull
	? SqlParserError<"NULL not allowed in BETWEEN">
	: Lm extends ExprSqlNull
		? SqlParserError<"NULL not allowed in BETWEEN">
		: H extends ExprSqlNull
			? SqlParserError<"NULL not allowed in BETWEEN">
			: E extends ExprOk<infer _TsE, infer Se extends string>
				? Lm extends ExprOk<infer _TsL, infer Sl extends string>
					? H extends ExprOk<infer _TsH, infer Sh extends string>
						? SameComparisonClass<Se, Sl> extends true
							? SameComparisonClass<Se, Sh> extends true
								? ExprOk<boolean, "boolean">
								: SqlParserError<"Incompatible types in BETWEEN">
							: SqlParserError<"Incompatible types in BETWEEN">
						: SqlParserError<"Invalid BETWEEN bound">
					: SqlParserError<"Invalid BETWEEN bound">
				: SqlParserError<"Invalid BETWEEN operand">

type MergeLikeOperands<Expr extends ExprAtom, Pat extends ExprAtom> = Expr extends ExprSqlNull
	? SqlParserError<"NULL not allowed in LIKE">
	: Pat extends ExprSqlNull
		? SqlParserError<"NULL not allowed in LIKE">
		: Expr extends ExprOk<infer _TsE, infer Se extends string>
			? Pat extends ExprOk<infer _TsP, infer Sp extends string>
				? IsSqlTextType<Se> extends true
					? IsSqlTextType<Sp> extends true
						? ExprOk<boolean, "boolean">
						: SqlParserError<"LIKE pattern must be text">
					: SqlParserError<"LIKE left operand must be text">
				: SqlParserError<"Invalid LIKE pattern">
			: SqlParserError<"Invalid LIKE operand">

type MergeCaseThenAccum<Acc extends ExprAtom | null, Tv extends ExprAtom> = Acc extends null
	? Tv
	: Acc extends ExprSqlNull
		? Tv extends ExprSqlNull
			? ExprSqlNull
			: Tv extends ExprOk<infer Tb, infer Sb>
				? ExprOk<Tb | null, Sb>
				: SqlParserError<"Invalid CASE branch">
		: Acc extends ExprOk<infer Ta, infer Sa extends string>
			? Tv extends ExprSqlNull
				? ExprOk<Ta | null, Sa>
				: Tv extends ExprOk<infer Tb, infer Sb extends string>
					? SameComparisonClass<Sa, Sb> extends true
						? ExprOk<Ta, Sa>
						: SqlParserError<"Incompatible types in CASE">
					: SqlParserError<"Invalid CASE branch">
			: SqlParserError<"Invalid CASE branch">

type ApplyCaseMissingElseNullability<E extends ExprAtom, MissingElse extends boolean> = MissingElse extends true
	? E extends ExprOk<infer Ts, infer Ss>
		? ExprOk<Ts | null, Ss>
		: E extends ExprSqlNull
			? ExprSqlNull
			: SqlParserError<"Invalid CASE expression">
	: E

type ResolveCaseSearchedArms<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Acc extends ExprAtom | null,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends SqlParserError<string>
			? Wv
			: Wv extends ExprOk<infer _Tw, infer Sw extends string>
				? IsSqlBooleanType<Sw> extends true
					? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
						? Tv extends SqlParserError<string>
							? Tv
							: Tv extends ExprAtom
								? MergeCaseThenAccum<Acc, Tv> extends infer Merged
									? Merged extends SqlParserError<string>
										? Merged
										: Merged extends ExprAtom
											? ResolveCaseSearchedArms<Rest, ElseB, Db, Scope, Merged, Params>
											: SqlParserError<"Invalid CASE branch">
									: never
								: SqlParserError<"Invalid CASE branch">
						: never
					: SqlParserError<"CASE WHEN must be boolean">
				: SqlParserError<"CASE WHEN must be boolean">
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends SqlParserError<string>
				? Ev
				: Ev extends ExprAtom
					? MergeCaseThenAccum<Acc, Ev> extends infer F
						? F extends SqlParserError<string>
							? F
							: F extends ExprAtom
								? ApplyCaseMissingElseNullability<F, false>
								: SqlParserError<"Invalid CASE expression">
						: never
					: SqlParserError<"Invalid CASE ELSE">
			: never
		: Acc extends ExprAtom
			? ApplyCaseMissingElseNullability<Acc, true>
			: SqlParserError<"Invalid CASE expression">

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
	Disc extends ExprAtom,
	Acc extends ExprAtom | null,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends SqlParserError<string>
			? Wv
			: Wv extends ExprAtom
				? ValidateCaseSimpleWhenMatch<Disc, Wv> extends infer Match
					? Match extends SqlParserError<string>
						? Match
						: Match extends true
							? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
								? Tv extends SqlParserError<string>
									? Tv
									: Tv extends ExprAtom
										? MergeCaseThenAccum<Acc, Tv> extends infer Merged
											? Merged extends SqlParserError<string>
												? Merged
												: Merged extends ExprAtom
													? ResolveCaseSimpleArms<
															Rest,
															ElseB,
															Db,
															Scope,
															Disc,
															Merged,
															Params
														>
													: SqlParserError<"Invalid CASE branch">
											: never
										: SqlParserError<"Invalid CASE branch">
								: never
							: never
					: never
				: SqlParserError<"Invalid CASE WHEN value">
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends SqlParserError<string>
				? Ev
				: Ev extends ExprAtom
					? MergeCaseThenAccum<Acc, Ev> extends infer F
						? F extends SqlParserError<string>
							? F
							: F extends ExprAtom
								? ApplyCaseMissingElseNullability<F, false>
								: SqlParserError<"Invalid CASE expression">
						: never
					: SqlParserError<"Invalid CASE ELSE">
			: never
		: Acc extends ExprAtom
			? ApplyCaseMissingElseNullability<Acc, true>
			: SqlParserError<"Invalid CASE expression">

type ResolveCaseSimple<
	DiscAst extends ScalarExprAst,
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<DiscAst, Db, Scope, Params> extends infer Dv
		? Dv extends SqlParserError<string>
			? Dv
			: Dv extends ExprAtom
				? ResolveCaseSimpleArms<Arms, ElseB, Db, Scope, Dv, null, Params>
				: SqlParserError<"Invalid CASE discriminant">
		: never

/** Per-element check for `expr IN (…)` (same class rules as `=`, but `NULL` list elements are rejected). */
type ValidateInListElement<L extends ExprAtom, R extends ExprAtom> = L extends ExprSqlNull
	? SqlParserError<"Invalid IN left operand">
	: R extends ExprSqlNull
		? SqlParserError<"Incompatible types in IN list">
		: L extends ExprOk<infer _TsL, infer Sl extends string>
			? R extends ExprOk<infer _TsR, infer Sr extends string>
				? SameComparisonClass<Sl, Sr> extends true
					? true
					: SqlParserError<"Incompatible types in IN list">
				: SqlParserError<"Invalid IN list element">
			: SqlParserError<"Invalid IN list element">

type ResolveInListItemsAgainstLeft<
	Left extends ExprAtom,
	Items extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Items extends readonly [infer H extends ScalarExprAst, ...infer Tail extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer Hv
		? Hv extends SqlParserError<string>
			? Hv
			: Hv extends ExprAtom
				? ValidateInListElement<Left, Hv> extends infer V
					? V extends SqlParserError<string>
						? V
						: V extends true
							? Tail extends readonly []
								? ExprOk<boolean, "boolean">
								: ResolveInListItemsAgainstLeft<Left, Tail, Db, Scope, Params>
							: never
					: never
				: SqlParserError<"Invalid IN list element">
		: never
	: SqlParserError<"IN list must not be empty">

type ResolveScalarSubquerySel<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["columns"]> extends true
		? keyof S["columns"] extends infer K extends keyof S["columns"]
			? S["columns"][K] extends infer ColType extends string
				? ExprOk<ColType | null, ColType>
				: SqlParserError<"Scalar subquery column inference failed">
			: SqlParserError<"Scalar subquery column inference failed">
		: SqlParserError<"Scalar subquery must project exactly one column">

type SubSelectColumnAtom<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["columns"]> extends true
		? keyof S["columns"] extends infer K extends keyof S["columns"]
			? S["columns"][K] extends infer ColType extends string
				? ExprOk<ColType, ColType>
				: SqlParserError<"IN subquery column inference failed">
			: SqlParserError<"IN subquery column inference failed">
		: SqlParserError<"IN subquery must project exactly one column">

type ResolveInSubqueryAst<
	Lexpr extends ScalarExprAst,
	Sub extends JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<Lexpr, Db, Scope, Params> extends infer Lv
		? Lv extends SqlParserError<string>
			? Lv
			: Lv extends ExprAtom
				? SubSelectColumnAtom<Sub> extends infer Rv
					? Rv extends SqlParserError<string>
						? Rv
						: Rv extends ExprAtom
							? ValidateInListElement<Lv, Rv> extends infer V
								? V extends SqlParserError<string>
									? V
									: V extends true
										? ExprOk<boolean, "boolean">
										: SqlParserError<"Incompatible types in IN subquery">
								: SqlParserError<"Incompatible types in IN subquery">
							: SqlParserError<"Invalid IN subquery column">
					: SqlParserError<"Invalid IN subquery column">
				: SqlParserError<"Invalid IN left operand">
		: never

type ResolveAnyAllSomeOp<
	Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst | JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends SqlParserError<string>
			? Lv
			: Lv extends ExprAtom
				? R extends JsqlSelectStatementResult
					? SubSelectColumnAtom<R> extends infer Rv
						? Rv extends SqlParserError<string>
							? Rv
							: Rv extends ExprAtom
								? MergeComparison<Lv, Rv> extends infer V
									? V extends SqlParserError<string>
										? V
										: ExprOk<boolean, "boolean">
									: SqlParserError<"Invalid ANY/ALL/SOME comparison">
								: SqlParserError<"Invalid ANY/ALL/SOME subquery column">
						: SqlParserError<"Invalid ANY/ALL/SOME subquery column">
					: R extends ScalarExprAst
						? ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
							? Rv extends SqlParserError<string>
								? Rv
								: Rv extends ExprOk<infer _RTs, infer RSql>
									? RSql extends `${string}[]` | "unknown"
										? ExprOk<boolean, "boolean">
										: SqlParserError<"ANY/ALL/SOME requires an array or subquery">
									: SqlParserError<"Invalid ANY/ALL/SOME operand">
							: never
						: SqlParserError<"Invalid ANY/ALL/SOME operand">
				: SqlParserError<"Invalid ANY/ALL/SOME left operand">
		: never

type MergeBoolNot<V> =
	V extends SqlParserError<string>
		? V
		: V extends ExprSqlNull
			? SqlParserError<"NOT argument must be boolean, not NULL">
			: V extends ExprOk<infer _T, infer S extends string>
				? IsSqlBooleanType<S> extends true
					? ExprOk<boolean, "boolean">
					: SqlParserError<"NOT requires a boolean operand">
				: SqlParserError<"NOT requires a boolean operand">

type MergeBoolBinary<L, R, Msg extends string> =
	L extends SqlParserError<string>
		? L
		: R extends SqlParserError<string>
			? R
			: L extends ExprSqlNull
				? SqlParserError<"NULL is not a valid boolean operand (use IS NULL)">
				: R extends ExprSqlNull
					? SqlParserError<"NULL is not a valid boolean operand (use IS NULL)">
					: L extends ExprOk<infer _Tl, infer Sl extends string>
						? R extends ExprOk<infer _Tr, infer Sr extends string>
							? IsSqlBooleanType<Sl> extends true
								? IsSqlBooleanType<Sr> extends true
									? ExprOk<boolean, "boolean">
									: SqlParserError<Msg>
								: SqlParserError<Msg>
							: SqlParserError<Msg>
						: SqlParserError<Msg>

/** `CAST` / `::` result typing (PostgreSQL-oriented compatibility checks). */
type ResolveCastFromAtom<Ev extends ExprAtom, N extends string> = Ev extends ExprSqlNull
	? ExprSqlNull
	: Ev extends ExprOk<infer Ts, infer _SFrom>
		? N extends "text" | "varchar" | "character varying" | "char"
			? Ts extends string | number | boolean
				? ExprOk<string, "text">
				: SqlParserError<"Invalid cast to text">
			: N extends "integer" | "int" | "int4" | "smallint" | "int2" | "serial" | "smallserial"
				? Ts extends number
					? ExprOk<number, "integer">
					: SqlParserError<"Invalid cast to integer">
				: N extends "bigint" | "int8" | "bigserial"
					? Ts extends number
						? ExprOk<number, "bigint">
						: SqlParserError<"Invalid cast to bigint">
					: N extends "boolean" | "bool"
						? Ts extends boolean
							? ExprOk<boolean, "boolean">
							: SqlParserError<"Invalid cast to boolean">
						: N extends "uuid"
							? Ts extends string
								? ExprOk<string, "uuid">
								: SqlParserError<"Invalid cast to uuid">
							: N extends "bytea"
								? Ts extends string
									? ExprOk<string, "bytea">
									: SqlParserError<"Invalid cast to bytea">
								: N extends
											| "timestamp"
											| "timestamp with time zone"
											| "timestamptz"
											| "date"
											| "time"
											| "time with time zone"
											| "timetz"
											| "interval"
									? Ts extends string
										? ExprOk<string, N>
										: SqlParserError<"Invalid cast to datetime/interval type">
									: N extends "inet" | "cidr"
										? Ts extends string
											? ExprOk<string, N>
											: SqlParserError<"Invalid cast to network address type">
										: N extends "tsvector" | "tsquery"
											? Ts extends string
												? ExprOk<string, N>
												: SqlParserError<"Invalid cast to full-text search type">
											: N extends
														| "real"
														| "float4"
														| "double precision"
														| "float8"
														| "numeric"
														| "decimal"
												? Ts extends number
													? ExprOk<number, "number">
													: SqlParserError<"Invalid cast to floating-point or numeric type">
												: ExprOk<unknown, N>
		: SqlParserError<"Invalid cast operand">

type MergeNumericArithmetic<L extends ExprAtom, R extends ExprAtom> = L extends ExprSqlNull
	? SqlParserError<"NULL not allowed in arithmetic">
	: R extends ExprSqlNull
		? SqlParserError<"NULL not allowed in arithmetic">
		: L extends ExprOk<infer _TsL, infer Sl extends string>
			? R extends ExprOk<infer _TsR, infer Sr extends string>
				? IsSqlNumericType<Sl> extends true
					? IsSqlNumericType<Sr> extends true
						? ExprOk<number, Sl>
						: SqlParserError<"Incompatible types in arithmetic">
					: SqlParserError<"Incompatible types in arithmetic">
				: never
			: never

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
	Tokens extends TokensList,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"]">
		? [SkipToken<Tokens>, Acc]
		: ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer Ele]
			? Ele extends SqlParserError<string>
				? SkipFailedExpression<R1, Ele>
				: Ele extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<"]">
						? [SkipToken<R1>, readonly [...Acc, Ele]]
						: PeekToken<R1> extends TokenKey<",">
							? ParseArrayCtorElementsAccum<SkipToken<R1>, readonly [...Acc, Ele], Env>
							: SkipFailedExpression<R1, SqlParserError<"Expected `,` or `]` in ARRAY constructor">>
					: never
			: never

type ParseArrayCtorAfterArrayKw<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"]">
				? [SkipToken<R1>, { kind: "array_ctor"; elements: readonly [] }]
				: ParseArrayCtorElementsAccum<R1, readonly [], Env> extends [infer R2 extends TokensList, infer Out]
					? Out extends SqlParserError<string>
						? SkipFailedExpression<R2, Out>
						: Out extends readonly ScalarExprAst[]
							? [R2, { kind: "array_ctor"; elements: Out }]
							: never
					: never
			: never
		: never

type ParsePostfixArrayIndexTail<Tokens extends TokensList, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer Ri extends TokensList
			? ParseOrScalarUntyped<Ri, Env> extends [infer Rj extends TokensList, infer Idx]
				? Idx extends SqlParserError<string>
					? SkipFailedExpression<Rj, Idx>
					: Idx extends ScalarExprAst
						? PeekToken<Rj> extends TokenKey<"]">
							? SkipToken<Rj> extends infer Rk extends TokensList
								? ParsePostfixArrayIndexTail<Rk, { kind: "array_index"; base: Acc; index: Idx }, Env>
								: never
							: SkipFailedExpression<Rj, SqlParserError<"Expected `]` after array subscript">>
						: never
				: never
			: never
		: [Tokens, Acc]

type TryParenOperandScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipToken<Tokens> extends infer Ri extends TokensList
			? PeekToken<Ri> extends TokenKey<"select">
				? ParseParenScalarSelect<Ri, Env["db"], Env["params"], Env["outerScope"]> extends [
						infer Rk extends TokensList,
						infer Sub,
					]
					? Sub extends SqlParserError<string>
						? SkipFailedExpression<Rk, Sub>
						: Sub extends JsqlSelectStatementResult
							? [Rk, { kind: "scalar_subquery"; sel: Sub }]
							: never
					: never
				: PeekToken<Ri> extends TokenKey<"with">
					? ParseParenScalarSelect<Ri, Env["db"], Env["params"], Env["outerScope"]> extends [
							infer Rw extends TokensList,
							infer Subw,
						]
						? Subw extends SqlParserError<string>
							? SkipFailedExpression<Rw, Subw>
							: Subw extends JsqlSelectStatementResult
								? [Rw, { kind: "scalar_subquery"; sel: Subw }]
								: never
						: never
					: ParseOrScalarUntyped<Ri, Env> extends [infer Rj extends TokensList, infer Ej]
						? Ej extends SqlParserError<string>
							? SkipFailedExpression<Rj, Ej>
							: PeekToken<Rj> extends infer TokCl
								? SkipToken<Rj> extends infer Rk2 extends TokensList
									? TokCl extends TokenKey<")">
										? [Rk2, Ej]
										: SkipFailedExpression<Rk2, SqlParserError<"Expected `)`">>
									: never
								: never
						: never
			: never
		: never

type TryOperandScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"cast">
		? ParseCastKeywordOperand<Tokens, Env>
		: PeekToken<Tokens> extends TokenKey<"case">
			? SkipToken<Tokens> extends infer Rcase extends TokensList
				? ParseCaseAfterCaseKw<Rcase, Env>
				: never
			: PeekToken<Tokens> extends TokenKey<"array">
				? SkipToken<Tokens> extends infer RarrKw extends TokensList
					? ParseArrayCtorAfterArrayKw<RarrKw, Env> extends [infer Rarr extends TokensList, infer ArrOut]
						? ArrOut extends SqlParserError<string>
							? SkipFailedExpression<Rarr, ArrOut>
							: ArrOut extends ScalarExprAst
								? [Rarr, ArrOut]
								: never
						: never
					: never
				: PeekToken<Tokens> extends TokenKey<"(">
					? TryParenOperandScalarUntyped<Tokens, Env>
					: PeekToken<Tokens> extends TokenKey<"true">
						? SkipToken<Tokens> extends infer Rt extends TokensList
							? [Rt, { kind: "true" }]
							: never
						: PeekToken<Tokens> extends TokenKey<"false">
							? SkipToken<Tokens> extends infer Rf extends TokensList
								? [Rf, { kind: "false" }]
								: never
							: PeekToken<Tokens> extends TokenKey<"null">
								? SkipToken<Tokens> extends infer Rn extends TokensList
									? [Rn, { kind: "sql_null" }]
									: never
								: PeekToken<Tokens> extends TokenString<infer Str>
									? SkipToken<Tokens> extends infer Rs extends TokensList
										? [Rs, { kind: "string"; value: Str }]
										: never
									: PeekToken<Tokens> extends TokenNumber<infer Raw>
										? SkipToken<Tokens> extends infer Rnum extends TokensList
											? [Rnum, { kind: "number"; raw: Raw }]
											: never
										: PeekToken<Tokens> extends TokenParam<infer P extends string>
											? SkipToken<Tokens> extends infer Rp extends TokensList
												? [Rp, { kind: "param"; name: P }]
												: never
											: SkipToken<Tokens> extends infer Rbad extends TokensList
												? SkipFailedExpression<Rbad, SqlParserError<"Unexpected token">>
												: never

type ParseUnaryScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer Rn extends TokensList
			? ParseUnaryScalarUntyped<Rn, Env> extends [infer Ru extends TokensList, infer U]
				? U extends SqlParserError<string>
					? SkipFailedExpression<Ru, U>
					: U extends ScalarExprAst
						? [Ru, { kind: "neg"; inner: U }]
						: never
				: never
			: never
		: TryOperandScalarUntyped<Tokens, Env> extends [infer Tu extends TokensList, infer Bu]
			? Bu extends SqlParserError<string>
				? SkipFailedExpression<Tu, Bu>
				: Bu extends ScalarExprAst
					? ParsePgCastSuffixTail<Tu, Bu> extends [
							infer Tp extends TokensList,
							infer Bp extends ScalarExprAst,
						]
						? ParsePostfixArrayIndexTail<Tp, Bp, Env>
						: never
					: never
			: never

type ParseMulLoopAfterFirstScalarUntyped<
	Tokens extends TokensList,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"*" | "/" | "%">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseExpScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? PeekToken<Tokens> extends TokenKey<"%">
							? ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mod"; left: Acc; right: E1 }, Env>
							: ParseMulLoopAfterFirstScalarUntyped<R2, { kind: "mul"; left: Acc; right: E1 }, Env>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseExpLoop<Tokens extends TokensList, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"^">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseUnaryScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? ParseExpLoop<R2, { kind: "exp"; left: Acc; right: E1 }, Env>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseExpScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseUnaryScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ParseExpLoop<R0, E0, Env>
				: never
		: never

type ParseMulScalarUntypedEntry<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseExpScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
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
							? SkipFailedExpression<R0, SqlParserError<"Incompatible types in arithmetic">>
							: [R0, E0]
						: never
					: ParseMulLoopAfterFirstScalarUntyped<R0, E0, Env>
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

type ParseOtherOpLoop<Tokens extends TokensList, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer P
		? IsOtherOp<P> extends true
			? SkipToken<Tokens> extends infer R1 extends TokensList
				? P extends TokenKey<infer Op>
					? ParseAddScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer Rhs]
						? Rhs extends SqlParserError<string>
							? SkipFailedExpression<R2, Rhs>
							: Rhs extends ScalarExprAst
								? ParseOtherOpLoop<R2, { kind: "custom_op"; op: Op; left: Acc; right: Rhs }, Env>
								: never
						: never
					: never
				: never
			: PeekToken<Tokens> extends TokenIdent<"operator">
				? SkipToken<Tokens> extends infer R1 extends TokensList
					? PeekToken<R1> extends TokenKey<"(">
						? SkipToken<R1> extends infer R2 extends TokensList
							? PeekToken<R2> extends TokenKey<infer Op>
								? SkipToken<R2> extends infer R3 extends TokensList
									? PeekToken<R3> extends TokenKey<")">
										? SkipToken<R3> extends infer R4 extends TokensList
											? ParseAddScalarUntyped<R4, Env> extends [
													infer R5 extends TokensList,
													infer Rhs,
												]
												? Rhs extends SqlParserError<string>
													? SkipFailedExpression<R5, Rhs>
													: Rhs extends ScalarExprAst
														? ParseOtherOpLoop<
																R5,
																{ kind: "custom_op"; op: Op; left: Acc; right: Rhs },
																Env
															>
														: never
												: never
											: never
										: SkipFailedExpression<R3, SqlParserError<"Expected ) after OPERATOR(">>
									: never
								: SkipFailedExpression<R2, SqlParserError<"Expected operator after OPERATOR(">>
							: never
						: SkipFailedExpression<R1, SqlParserError<"Expected `(` after OPERATOR">>
					: never
				: [Tokens, Acc]
		: [Tokens, Acc]

type ParseOtherOpScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseAddScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ParseOtherOpLoop<R0, E0, Env>
				: never
		: never

type ParseAddLoopAfterPlusScalarUntyped<
	Tokens extends TokensList,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseMulScalarUntypedEntry<R1, Env> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? ParseAddLoopAfterFirstScalarUntyped<R2, MergeScalarAstAddSub<"add", Acc, E1>, Env>
						: never
				: never
			: never
		: never

type ParseAddLoopAfterMinusScalarUntyped<
	Tokens extends TokensList,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer R3 extends TokensList
			? ParseMulScalarUntypedEntry<R3, Env> extends [infer R4 extends TokensList, infer E2]
				? E2 extends SqlParserError<string>
					? SkipFailedExpression<R4, E2>
					: E2 extends ScalarExprAst
						? ParseAddLoopAfterFirstScalarUntyped<R4, MergeScalarAstAddSub<"sub", Acc, E2>, Env>
						: never
				: never
			: never
		: never

type MergeScalarAstAddSub<Op extends "add" | "sub", L extends ScalarExprAst, R extends ScalarExprAst> = Op extends "add"
	? { kind: "add"; left: L; right: R }
	: { kind: "sub"; left: L; right: R }

type ParseAddLoopAfterFirstScalarUntyped<
	Tokens extends TokensList,
	Acc extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? ParseAddLoopAfterPlusScalarUntyped<Tokens, Acc, Env>
		: PeekToken<Tokens> extends TokenKey<"-">
			? ParseAddLoopAfterMinusScalarUntyped<Tokens, Acc, Env>
			: [Tokens, Acc]

type ParseScalarExprUntypedFromIdent<Tokens extends TokensList, Env extends ExprParseEnv> =
	MaximalIdentChain<Tokens> extends [infer Rm extends TokensList, infer Parts]
		? Parts extends readonly ["__ats__", infer Al extends string]
			? PeekToken<Rm> extends TokenKey<"(">
				? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [infer After extends TokensList, infer Rs]
					? Rs extends SqlParserError<string>
						? SkipFailedExpression<After, SqlParserError<"Unbalanced parentheses">>
						: SkipFailedExpression<SkipToken<After>, SqlParserError<"Unsupported parenthesized expression">>
					: never
				: [Rm, { kind: "alias_table_star"; alias: Al }]
			: Parts extends readonly ["__qts__", infer Sch extends string, infer Tab extends string]
				? PeekToken<Rm> extends TokenKey<"(">
					? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [
							infer After extends TokensList,
							infer Rs,
						]
						? Rs extends SqlParserError<string>
							? SkipFailedExpression<After, SqlParserError<"Unbalanced parentheses">>
							: SkipFailedExpression<
									SkipToken<After>,
									SqlParserError<"Unsupported parenthesized expression">
								>
						: never
					: [Rm, { kind: "qualified_table_star"; schema: Sch; table: Tab }]
				: Parts extends ScalarIdentParts
					? PeekToken<Rm> extends TokenKey<"(">
						? ParseFunctionArgs<SkipToken<Rm>, Env> extends [infer After extends TokensList, infer Args]
							? Args extends SqlParserError<string>
								? SkipFailedExpression<After, Args>
								: Args extends readonly (ScalarExprAst | { kind: "star" })[]
									? Parts extends readonly [infer FnName extends string]
										? ParseOptionalOverClause<After, FnName, Args, Env>
										: SkipFailedExpression<
												After,
												SqlParserError<"Qualified function names are not supported">
											>
									: never
							: never
						: PeekToken<Rm> extends infer Pa
							? Pa extends TokenKey<"::">
								? ParsePgCastSuffixTail<Rm, { kind: "col"; parts: Parts }> extends [
										infer Rcast extends TokensList,
										infer Casted extends ScalarExprAst,
									]
									? PeekToken<Rcast> extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
										? ParseAddLoopAfterFirstScalarUntyped<Rcast, Casted, Env>
										: [Rcast, Casted]
									: never
								: Pa extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
									? ParseAddLoopAfterFirstScalarUntyped<Rm, { kind: "col"; parts: Parts }, Env>
									: [Rm, { kind: "col"; parts: Parts }]
							: never
					: never
		: never

type ParseScalarExprUntypedNonIdent<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseMulScalarUntypedEntry<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
					? PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? SkipFailedExpression<R0, SqlParserError<"Incompatible types in arithmetic">>
							: [R0, E0]
						: never
					: ParseAddLoopAfterFirstScalarUntyped<R0, E0, Env>
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
		? Lv extends SqlParserError<string>
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends SqlParserError<string>
					? Rv
					: Lv extends ExprAtom
						? Rv extends ExprAtom
							? MergeNumericArithmetic<Lv, Rv>
							: SqlParserError<"Invalid arithmetic operand">
						: SqlParserError<"Invalid arithmetic operand">
				: never
		: never

type ResolveScalarExprAstNeg<
	I extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<I, Db, Scope, Params> extends infer U
		? U extends SqlParserError<string>
			? U
			: U extends ExprOk<infer _Tu, infer Su extends string>
				? IsSqlNumericType<Su> extends true
					? ExprOk<number, Su>
					: SqlParserError<"Unary minus requires a number">
				: SqlParserError<"Unary minus requires a number">
		: never

/** Operand for scalar `+` / `-` / `*` (parenthesized subexpression is a value, not a boolean `OR` chain). */
type TryValueOperand<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipToken<Tokens> extends infer Ri extends TokensList
			? ParseAddValue<Ri, Db, Scope, Params> extends [infer Rj extends TokensList, infer Ej]
				? Ej extends SqlParserError<string>
					? SkipFailedExpression<Rj, Ej>
					: PeekToken<Rj> extends infer TokCl
						? SkipToken<Rj> extends infer Rk extends TokensList
							? TokCl extends TokenKey<")">
								? Ej extends ExprAtom
									? [Rk, Ej]
									: never
								: SkipFailedExpression<Rk, SqlParserError<"Expected `)`">>
							: never
						: never
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"true">
			? SkipToken<Tokens> extends infer R extends TokensList
				? [R, ExprOk<true, "boolean">]
				: never
			: PeekToken<Tokens> extends TokenKey<"false">
				? SkipToken<Tokens> extends infer Rf extends TokensList
					? [Rf, ExprOk<false, "boolean">]
					: never
				: PeekToken<Tokens> extends TokenKey<"null">
					? SkipToken<Tokens> extends infer Rn extends TokensList
						? [Rn, ExprSqlNull]
						: never
					: PeekToken<Tokens> extends TokenString<string>
						? SkipToken<Tokens> extends infer Rs extends TokensList
							? [Rs, ExprOk<string, "text">]
							: never
						: PeekToken<Tokens> extends TokenNumber<string>
							? SkipToken<Tokens> extends infer Rnum extends TokensList
								? [Rnum, ExprOk<number, "integer">]
								: never
							: PeekToken<Tokens> extends TokenParam<infer P extends string>
								? SkipToken<Tokens> extends infer Rp extends TokensList
									? LookupParam<Params, P> extends infer PV
										? PV extends SqlParserError<string>
											? SkipFailedExpression<Rp, PV>
											: PV extends ExprOk<infer Tsp, infer SqlP extends string>
												? [Rp, ExprOk<Tsp, SqlP>]
												: never
										: never
									: never
								: PeekToken<Tokens> extends TokenIdent<string>
									? TryOperandIdentOrCall<
											Tokens,
											{ db: Db; params: Params; outerScope: Scope }
										> extends [infer Rident extends TokensList, infer IdentOut]
										? IdentOut extends SqlParserError<string>
											? SkipFailedExpression<Rident, IdentOut>
											: IdentOut extends ExprAtom
												? [Rident, IdentOut]
												: SkipFailedExpression<
														Rident,
														SqlParserError<"Unsupported identifier expression">
													>
										: never
									: SkipToken<Tokens> extends infer Rbad extends TokensList
										? SkipFailedExpression<Rbad, SqlParserError<"Unexpected token">>
										: never

type ParseValuePgCastSuffix<Tokens extends TokensList, Acc extends ExprAtom> =
	PeekToken<Tokens> extends TokenKey<"::">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseSqlTypeName<R0, []> extends [infer R1 extends TokensList, infer Parts]
				? Parts extends SqlParserError<string>
					? SkipFailedExpression<R1, Parts>
					: Parts extends readonly []
						? SkipFailedExpression<R1, SqlParserError<"Expected type name after ::">>
						: Parts extends readonly string[]
							? SqlCastTypeNorm<Parts> extends infer Norm extends string
								? ResolveCastFromAtom<Acc, Norm> extends infer Casted
									? Casted extends SqlParserError<string>
										? SkipFailedExpression<R1, Casted>
										: Casted extends ExprAtom
											? ParseValuePgCastSuffix<R1, Casted>
											: never
									: never
								: SkipFailedExpression<R1, SqlParserError<"Invalid cast target">>
							: never
				: never
			: never
		: [Tokens, Acc]

type ParsePrimaryValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	TryValueOperand<Tokens, Db, Scope, Params> extends [infer R extends TokensList, infer E]
		? E extends SqlParserError<string>
			? SkipFailedExpression<R, E>
			: E extends ExprAtom
				? ParseValuePgCastSuffix<R, E>
				: never
		: never

type ParseUnaryValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer Rn extends TokensList
			? ParseUnaryValue<Rn, Db, Scope, Params> extends [infer Ru extends TokensList, infer U]
				? U extends SqlParserError<string>
					? SkipFailedExpression<Ru, U>
					: U extends ExprOk<infer _Tu, infer Su extends string>
						? IsSqlNumericType<Su> extends true
							? [Ru, ExprOk<number, Su>]
							: SkipFailedExpression<Ru, SqlParserError<"Unary minus requires a number">>
						: never
				: never
			: never
		: ParsePrimaryValue<Tokens, Db, Scope, Params>

type ParseMulLoopAfterFirst<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Acc extends ExprOk<number, string>,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"*">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseUnaryValue<R1, Db, Scope, Params> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? SkipFailedExpression<R2, E1>
					: E1 extends ExprAtom
						? MergeNumericArithmetic<Acc, E1> extends infer M
							? M extends SqlParserError<string>
								? SkipFailedExpression<R2, M>
								: M extends ExprOk<number, string>
									? ParseMulLoopAfterFirst<R2, Db, Scope, M, Params>
									: never
							: never
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseMulValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseUnaryValue<Tokens, Db, Scope, Params> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
			: E0 extends ExprOk<infer _T0, infer S0 extends string>
				? IsSqlNumericType<S0> extends true
					? ParseMulLoopAfterFirst<R0, Db, Scope, ExprOk<number, S0>, Params>
					: PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? SkipFailedExpression<R0, SqlParserError<"Incompatible types in arithmetic">>
							: [R0, E0]
						: never
				: never
		: never

type ParseAddLoopAfterFirst<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Acc extends ExprOk<number, string>,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"+">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseMulValue<R1, Db, Scope, Params> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? SkipFailedExpression<R2, E1>
					: E1 extends ExprAtom
						? MergeNumericArithmetic<Acc, E1> extends infer M
							? M extends SqlParserError<string>
								? SkipFailedExpression<R2, M>
								: M extends ExprOk<number, string>
									? ParseAddLoopAfterFirst<R2, Db, Scope, M, Params>
									: never
							: never
						: never
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"-">
			? SkipToken<Tokens> extends infer R3 extends TokensList
				? ParseMulValue<R3, Db, Scope, Params> extends [infer R4 extends TokensList, infer E2]
					? E2 extends SqlParserError<string>
						? SkipFailedExpression<R4, E2>
						: E2 extends ExprAtom
							? MergeNumericArithmetic<Acc, E2> extends infer M2
								? M2 extends SqlParserError<string>
									? SkipFailedExpression<R4, M2>
									: M2 extends ExprOk<number, string>
										? ParseAddLoopAfterFirst<R4, Db, Scope, M2, Params>
										: never
								: never
							: never
					: never
				: never
			: [Tokens, Acc]

/** Typed scalar for INSERT/UPDATE cells (literals, columns, `:param`, parentheses, numeric ops). */
export type ParseAddValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseMulValue<Tokens, Db, Scope, Params> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? SkipFailedExpression<R0, E0>
			: E0 extends ExprOk<infer _T0, infer S0 extends string>
				? IsSqlNumericType<S0> extends true
					? ParseAddLoopAfterFirst<R0, Db, Scope, ExprOk<number, S0>, Params>
					: PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? SkipFailedExpression<R0, SqlParserError<"Incompatible types in arithmetic">>
							: [R0, E0]
						: never
				: never
		: never
