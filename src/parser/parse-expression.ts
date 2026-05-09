import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type {
	PeekToken,
	SkipToken,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenParam,
	TokenString,
	TokensList,
} from "../lexer/sql-tokens.ts"
import type { FormatError, DbtyperError } from "../sql-parser-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ParseParenEnclosedSelect, ParseParenScalarSelect } from "./parse-select.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"
import type { SkipBracketedUntil, SkipFailedExpression } from "./skip-statement.ts"
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

/** Caller-supplied `:name` bindings (names must match lexer param identifiers). */
export type ExpressionParamsShape = Record<string, SqlTypeShape>

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
					? Rs extends DbtyperError<any, any>
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
				? SkipFailedExpression<Tokens, FormatError<"EXPECTED_TYPE_NAME", []>>
				: [Tokens, Acc]
			: Acc extends readonly []
				? SkipFailedExpression<Tokens, FormatError<"EXPECTED_TYPE_NAME", []>>
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
						? Inner extends DbtyperError<any, any>
							? SkipFailedExpression<R2, Inner>
							: Inner extends ScalarExprAst
								? PeekToken<R2> extends TokenKey<"as">
									? SkipToken<R2> extends infer R3 extends TokensList
										? ParseSqlTypeName<R3, []> extends [infer R4 extends TokensList, infer Parts]
											? Parts extends DbtyperError<any, any>
												? SkipFailedExpression<R4, Parts>
												: Parts extends readonly []
													? SkipFailedExpression<
															R4,
															FormatError<"EXPECTED_TYPE_NAME_AFTER_CAST_AS", []>
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
																			FormatError<
																				"EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE",
																				[]
																			>,
																		]
																: never
															: never
														: never
											: never
										: never
									: SkipFailedExpression<R2, FormatError<"EXPECTED_AS_IN_CAST", []>>
								: never
						: never
					: never
				: SkipFailedExpression<R0, FormatError<"EXPECTED_OPEN_PAREN_AFTER_CAST", []>>
			: never
		: never

type ParsePgCastSuffixTail<Tokens extends TokensList, Acc extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"::">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseSqlTypeName<R0, []> extends [infer R1 extends TokensList, infer Parts]
				? Parts extends DbtyperError<any, any>
					? SkipFailedExpression<R1, Parts>
					: Parts extends readonly []
						? SkipFailedExpression<R1, FormatError<"EXPECTED_TYPE_NAME_AFTER_DOUBLE_COLON", []>>
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
		? E extends DbtyperError<any, any>
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
						: SkipFailedExpression<R1, FormatError<"EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST", []>>
				: never
		: never

type ParseInListUntypedTail<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<")">
		? SkipFailedExpression<Tokens, FormatError<"IN_LIST_MUST_NOT_BE_EMPTY", []>>
		: PeekToken<Tokens> extends TokenKey<"select">
			? ParseParenEnclosedSelect<Tokens, Env["db"], Env["params"], Env["outerScope"]> extends [
					infer R9 extends TokensList,
					infer Sub,
				]
				? Sub extends DbtyperError<any, any>
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
					? ListRes extends DbtyperError<any, any>
						? SkipFailedExpression<R9, ListRes>
						: ListRes extends JsqlSelectStatementResult
							? [R9, { kind: "in_subquery"; expr: L; sub: ListRes }]
							: ListRes extends readonly ScalarExprAst[]
								? [R9, { kind: "in_list"; expr: L; items: ListRes }]
								: never
					: never
				: SkipFailedExpression<R8, FormatError<"EXPECTED_OPEN_PAREN_AFTER_IN", []>>
			: never
		: never

type ParseBetweenAfterL<Tokens extends TokensList, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"between">
		? SkipToken<Tokens> extends infer Rb extends TokensList
			? ParseAddScalarUntyped<Rb, Env> extends [infer Rlow extends TokensList, infer Low]
				? Low extends DbtyperError<any, any>
					? SkipFailedExpression<Rlow, Low>
					: PeekToken<Rlow> extends TokenKey<"and">
						? SkipToken<Rlow> extends infer Ra extends TokensList
							? ParseOtherOpScalarUntyped<Ra, Env> extends [infer Rh extends TokensList, infer High]
								? High extends DbtyperError<any, any>
									? SkipFailedExpression<Rh, High>
									: [Rh, { kind: "between"; expr: L; low: Low; high: High }]
								: never
							: never
						: SkipFailedExpression<Rlow, FormatError<"EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS", []>>
				: never
			: never
		: never

type ParseLikeAfterL<Tokens extends TokensList, L extends ScalarExprAst, CI extends boolean, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer TokKw
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? TokKw extends TokenKey<"like"> | TokenKey<"ilike">
				? ParseOtherOpScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer Pat]
					? Pat extends DbtyperError<any, any>
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
				? SkipFailedExpression<Rend, FormatError<"CASE_REQUIRES_AT_LEAST_ONE_WHEN", []>>
				: Disc extends null
					? [Rend, { kind: "case_searched"; arms: Acc; else_: ElseB }]
					: [Rend, { kind: "case_simple"; discriminant: Disc; arms: Acc; else_: ElseB }]
			: never
		: SkipFailedExpression<Tokens, FormatError<"EXPECTED_END_AFTER_CASE", []>>

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
					? Ea extends DbtyperError<any, any>
						? SkipFailedExpression<Rel, Ea>
						: Ea extends ScalarExprAst
							? ParseCaseExpectEndKeyword<Rel, Acc, Ea, Disc>
							: never
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"end">
				? ParseCaseExpectEndKeyword<Tokens, Acc, null, Disc>
				: SkipFailedExpression<Tokens, FormatError<"EXPECTED_WHEN_ELSE_OR_END_IN_CASE", []>>

type ParseCaseWhenArmsThenElseEnd<
	Tokens extends TokensList,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? SkipToken<Tokens> extends infer Rw extends TokensList
			? ParseOrScalarUntyped<Rw, Env> extends [infer Rcond extends TokensList, infer Wast]
				? Wast extends DbtyperError<any, any>
					? SkipFailedExpression<Rcond, Wast>
					: Wast extends ScalarExprAst
						? PeekToken<Rcond> extends TokenKey<"then">
							? SkipToken<Rcond> extends infer Rt extends TokensList
								? ParseOrScalarUntyped<Rt, Env> extends [infer Rth extends TokensList, infer Thast]
									? Thast extends DbtyperError<any, any>
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
							: SkipFailedExpression<Rcond, FormatError<"EXPECTED_THEN_AFTER_CASE_WHEN", []>>
						: never
				: never
			: never
		: never

/** After `CASE` keyword: searched `CASE WHEN` or simple `CASE expr WHEN`. */
type ParseCaseAfterCaseKw<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, readonly [], null, Env>
		: ParseOrScalarUntyped<Tokens, Env> extends [infer Rd extends TokensList, infer Dast]
			? Dast extends DbtyperError<any, any>
				? SkipFailedExpression<Rd, Dast>
				: Dast extends ScalarExprAst
					? PeekToken<Rd> extends TokenKey<"when">
						? ParseCaseWhenArmsThenElseEnd<Rd, readonly [], Dast, Env>
						: SkipFailedExpression<Rd, FormatError<"EXPECTED_WHEN_AFTER_CASE_EXPRESSION", []>>
					: never
			: never

type ParseAfterIsUntyped<Tokens extends TokensList, L extends ScalarExprAst> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R5 extends TokensList
			? PeekToken<R5> extends TokenKey<"null">
				? SkipToken<R5> extends infer R6 extends TokensList
					? [R6, { kind: "is_not_null"; expr: L }]
					: never
				: SkipFailedExpression<R5, FormatError<"EXPECTED_NULL_AFTER_IS_NOT", []>>
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? SkipToken<Tokens> extends infer R7 extends TokensList
				? [R7, { kind: "is_null"; expr: L }]
				: never
			: SkipFailedExpression<Tokens, FormatError<"EXPECTED_NULL_AFTER_IS", []>>

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
								? Sub extends DbtyperError<any, any>
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
											: SkipFailedExpression<R3, FormatError<"INVALID_COMPARISON_OPERATOR", []>>
										: never
								: never
							: ParseOrScalarUntyped<R2, Env> extends [infer R4 extends TokensList, infer ArrExpr]
								? ArrExpr extends DbtyperError<any, any>
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
															FormatError<"INVALID_COMPARISON_OPERATOR", []>
														>
												: never
											: SkipFailedExpression<
													R4,
													FormatError<
														"EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION",
														[]
													>
												>
										: never
								: never
						: never
					: SkipFailedExpression<R1, FormatError<"EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME", []>>
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
						? Rhs extends DbtyperError<any, any>
							? SkipFailedExpression<R3, Rhs>
							: TokenToCmpOp<P> extends infer Cop extends ScalarCmpOp
								? [R3, { kind: "cmp"; op: Cop; left: L; right: Rhs }]
								: SkipFailedExpression<R3, FormatError<"INVALID_COMPARISON_OPERATOR", []>>
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
									? Pat extends DbtyperError<any, any>
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
										? Pati extends DbtyperError<any, any>
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
											? Patn extends DbtyperError<any, any>
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
												? Patni extends DbtyperError<any, any>
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
		? E1 extends DbtyperError<any, any>
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
							? Sub extends DbtyperError<any, any>
								? SkipFailedExpression<Rex2, Sub>
								: Sub extends JsqlSelectStatementResult
									? [Rex2, { kind: "exists_subquery"; sub: Sub }]
									: never
							: never
						: SkipFailedExpression<Rex1, FormatError<"EXPECTED_SELECT_IN_EXISTS_SUBQUERY", []>>
					: never
				: SkipFailedExpression<Rex0, FormatError<"EXPECTED_OPEN_PAREN_AFTER_EXISTS", []>>
			: never
		: PeekToken<Tokens> extends TokenKey<"not">
			? SkipToken<Tokens> extends infer Rn extends TokensList
				? ParseNotScalarUntyped<Rn, Env> extends [infer Ru extends TokensList, infer U]
					? U extends DbtyperError<any, any>
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
				? E1 extends DbtyperError<any, any>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? ParseAndLoopScalarUntyped<R2, { kind: "and"; left: Acc; right: E1 }, Env>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseAndScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseNotScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends DbtyperError<any, any>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ParseAndLoopScalarUntyped<R0, E0, Env>
				: never
		: never

type ParseOrLoopScalarUntyped<Tokens extends TokensList, Acc extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"or">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseAndScalarUntyped<R1, Env> extends [infer R2 extends TokensList, infer E1]
				? E1 extends DbtyperError<any, any>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? ParseOrLoopScalarUntyped<R2, { kind: "or"; left: Acc; right: E1 }, Env>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseOrScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseAndScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends DbtyperError<any, any>
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
	Acc extends readonly SqlTypeShape[] = [],
> = Args extends readonly [infer First, ...infer Rest extends readonly (ScalarExprAst | { kind: "star" })[]]
	? First extends { kind: "star" }
		? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, SqlUnknown]>
		: First extends ScalarExprAst
			? ResolveExpressionAST<First, Db, Scope, Params> extends infer Res
				? Res extends DbtyperError<any, any>
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
				? ArgsRes extends DbtyperError<any, any>
					? ArgsRes
					: ArgsRes extends readonly SqlTypeShape[]
						? SqlBigint
						: never
				: never
			: FormatError<"STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT", []>
		: ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
			? ArgsRes extends DbtyperError<any, any>
				? ArgsRes
				: ArgsRes extends readonly SqlTypeShape[]
					? L extends "count"
						? SqlBigint
						: L extends "lower" | "upper"
							? ArgsRes extends readonly [SqlTypeShape, ...infer _Rest]
								? SqlText
								: ArgsRes extends readonly []
									? FormatError<"FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT", []>
									: FormatError<"FUNCTION_EXPECTS_TEXT_ARGUMENT", []>
							: L extends "coalesce"
								? ArgsRes extends readonly []
									? FormatError<"COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT", []>
									: ArgsRes[0] extends SqlTypeShape
										? ArgsRes[0]
										: SqlUnknown
								: L extends "now"
									? ArgsRes extends readonly []
										? SqlTimestamp
										: FormatError<"NOW_TAKES_NO_ARGUMENTS", []>
									: L extends "sum"
										? ArgsRes extends readonly [SqlTypeShape, ...infer _R]
											? SqlNumeric
											: FormatError<"SUM_REQUIRES_AN_ARGUMENT", []>
										: L extends "uuid_generate_v4" | "gen_random_uuid"
											? ArgsRes extends readonly []
												? SqlUuid
												: FormatError<"THIS_FUNCTION_TAKES_NO_ARGUMENTS", []>
											: L extends "array_length"
												? ArgsRes extends readonly [
														infer S1 extends SqlTypeShape,
														infer _S2 extends SqlTypeShape,
													]
													? S1["type"] extends "array" | "unknown"
														? SqlInteger
														: FormatError<"ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER", []>
													: FormatError<"ARRAY_LENGTH_REQUIRES_2_ARGUMENTS", []>
												: L extends "array_append"
													? ArgsRes extends readonly [
															infer S1 extends SqlTypeShape,
															SqlTypeShape,
														]
														? S1["type"] extends "array" | "unknown"
															? SqlUnknown
															: FormatError<"ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT", []>
														: FormatError<"ARRAY_APPEND_REQUIRES_2_ARGUMENTS", []>
													: L extends "array_prepend"
														? ArgsRes extends readonly [
																SqlTypeShape,
																infer S2 extends SqlTypeShape,
															]
															? S2["type"] extends "array" | "unknown"
																? SqlUnknown
																: FormatError<"ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY", []>
															: FormatError<"ARRAY_PREPEND_REQUIRES_2_ARGUMENTS", []>
														: L extends "unnest"
															? ArgsRes extends readonly [infer S1 extends SqlTypeShape]
																? S1["type"] extends "array" | "unknown"
																	? SqlUnknown
																	: FormatError<"UNNEST_EXPECTS_AN_ARRAY", []>
																: FormatError<"UNNEST_REQUIRES_1_ARGUMENT", []>
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
																		: FormatError<"UNKNOWN_FUNCTION", [Name]>
																	: FormatError<"UNKNOWN_FUNCTION", [Name]>
																: FormatError<"UNKNOWN_FUNCTION", [Name]>
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
		: FormatError<"ROW_NUMBER_TAKES_NO_ARGUMENTS", []>
	: L extends "rank" | "dense_rank"
		? Args extends readonly []
			? SqlBigint
			: FormatError<"RANK_DENSE_RANK_TAKES_NO_ARGUMENTS", []>
		: L extends "lag" | "lead"
			? ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
				? ArgsRes extends DbtyperError<any, any>
					? ArgsRes
					: ArgsRes extends readonly [infer S extends SqlTypeShape, ...infer _Rest]
						? S
						: ArgsRes extends readonly []
							? FormatError<"LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT", []>
							: FormatError<"INVALID_LAG_LEAD_ARGUMENTS", []>
				: never
			: FormatError<"UNKNOWN_WINDOW_FUNCTION", []>

type ResolveCustomOp<
	Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperError<any, any>
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperError<any, any>
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? Op extends "@>" | "&&" | "<@"
								? SqlBoolean
								: Op extends "||"
									? Lv["type"] extends "array"
										? Rv["type"] extends "text"
											? FormatError<"CANNOT_CONCATENATE_ARRAY_WITH_TEXT", []>
											: Rv["type"] extends "array"
												? Lv
												: Lv
										: Rv["type"] extends "array"
											? Lv["type"] extends "text"
												? FormatError<"CANNOT_CONCATENATE_TEXT_WITH_ARRAY", []>
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
													: FormatError<"CANNOT_CONCATENATE_TEXT_WITH_TYPE", [Rv["type"]]>
												: Rv["type"] extends "text"
													? Lv["type"] extends
															| "integer"
															| "bigint"
															| "numeric"
															| "uuid"
															| "boolean"
														? SqlText
														: FormatError<"CANNOT_CONCATENATE_TYPE_WITH_TEXT", [Lv["type"]]>
													: FormatError<"CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND", []>
									: SqlUnknown
							: FormatError<"INVALID_CUSTOM_OPERATOR_OPERAND", []>
						: FormatError<"INVALID_CUSTOM_OPERATOR_OPERAND", []>
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
		? V extends DbtyperError<any, any>
			? V
			: V extends SqlTypeShape
				? ResolveArrayCtorElements<R, Db, Scope, Params, readonly [...AccTypes, V]>
				: FormatError<"INVALID_ARRAY_ELEMENT", []>
		: never
	: InferArrayType<AccTypes>

type InferArrayType<Types extends readonly SqlTypeShape[]> = Types extends readonly []
	? FormatError<"CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY", []>
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

export type ParseExpressionAST<Tokens extends TokensList, Env extends ExprParseEnv> = ParseOrScalarUntyped<Tokens, Env>

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
	qualified_table_star: FormatError<"QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS", []>
	alias_table_star: FormatError<"QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS", []>
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
			? Lv extends DbtyperError<any, any>
				? Lv
				: ResolveExpressionAST<I, Db, Scope, Params> extends infer Rv
					? Rv extends DbtyperError<any, any>
						? Rv
						: Lv extends SqlTypeShape
							? Rv extends SqlTypeShape
								? SqlUnknown
								: FormatError<"INVALID_ARRAY_SUBSCRIPT_OPERAND", []>
							: FormatError<"INVALID_ARRAY_BASE_OPERAND", []>
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
				? LcV extends DbtyperError<any, any>
					? LcV
					: RcV extends DbtyperError<any, any>
						? RcV
						: LcV extends SqlTypeShape
							? RcV extends SqlTypeShape
								? MergeComparison<LcV, RcV>
								: FormatError<"INVALID_COMPARISON_OPERAND", []>
							: FormatError<"INVALID_COMPARISON_OPERAND", []>
				: never
			: never
		: never
	is_null: Ast extends { kind: "is_null"; expr: infer E0 extends ScalarExprAst }
		? ResolveExpressionAST<E0, Db, Scope, Params> extends infer V0
			? V0 extends DbtyperError<any, any>
				? V0
				: V0 extends SqlTypeShape
					? SqlBoolean
					: FormatError<"INVALID_IS_NULL_OPERAND", []>
			: never
		: never
	is_not_null: Ast extends { kind: "is_not_null"; expr: infer E1 extends ScalarExprAst }
		? ResolveExpressionAST<E1, Db, Scope, Params> extends infer V1
			? V1 extends DbtyperError<any, any>
				? V1
				: V1 extends SqlTypeShape
					? SqlBoolean
					: FormatError<"INVALID_IS_NOT_NULL_OPERAND", []>
			: never
		: never
	pg_cast: Ast extends {
		kind: "pg_cast"
		expr: infer Exc extends ScalarExprAst
		type_parts: infer Ptc extends readonly string[]
	}
		? ResolveExpressionAST<Exc, Db, Scope, Params> extends infer Evc
			? Evc extends DbtyperError<any, any>
				? Evc
				: Evc extends SqlTypeShape
					? SqlCastTypeNorm<Ptc> extends infer Normc extends string
						? ResolveCastFromShape<Evc, Normc>
						: FormatError<"INVALID_CAST_TARGET", []>
					: FormatError<"INVALID_CAST_OPERAND", []>
			: never
		: never
	sql_cast: Ast extends {
		kind: "sql_cast"
		expr: infer Exs extends ScalarExprAst
		type_parts: infer Pts extends readonly string[]
	}
		? ResolveExpressionAST<Exs, Db, Scope, Params> extends infer Evs
			? Evs extends DbtyperError<any, any>
				? Evs
				: Evs extends SqlTypeShape
					? SqlCastTypeNorm<Pts> extends infer Norms extends string
						? ResolveCastFromShape<Evs, Norms>
						: FormatError<"INVALID_CAST_TARGET", []>
					: FormatError<"INVALID_CAST_OPERAND", []>
			: never
		: never
	between: Ast extends {
		kind: "between"
		expr: infer Eb extends ScalarExprAst
		low: infer Lb extends ScalarExprAst
		high: infer Hb extends ScalarExprAst
	}
		? ResolveExpressionAST<Eb, Db, Scope, Params> extends infer EvB
			? EvB extends DbtyperError<any, any>
				? EvB
				: ResolveExpressionAST<Lb, Db, Scope, Params> extends infer LvB
					? LvB extends DbtyperError<any, any>
						? LvB
						: ResolveExpressionAST<Hb, Db, Scope, Params> extends infer HvB
							? HvB extends DbtyperError<any, any>
								? HvB
								: EvB extends SqlTypeShape
									? LvB extends SqlTypeShape
										? HvB extends SqlTypeShape
											? MergeBetweenBounds<EvB, LvB, HvB>
											: FormatError<"INVALID_BETWEEN_BOUND", []>
										: FormatError<"INVALID_BETWEEN_BOUND", []>
									: FormatError<"INVALID_BETWEEN_OPERAND", []>
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
			? EvL extends DbtyperError<any, any>
				? EvL
				: ResolveExpressionAST<Pl, Db, Scope, Params> extends infer PvL
					? PvL extends DbtyperError<any, any>
						? PvL
						: EvL extends SqlTypeShape
							? PvL extends SqlTypeShape
								? MergeLikeOperands<EvL, PvL>
								: FormatError<"INVALID_LIKE_PATTERN", []>
							: FormatError<"INVALID_LIKE_OPERAND", []>
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
			? EvR extends DbtyperError<any, any>
				? EvR
				: ResolveExpressionAST<Pr, Db, Scope, Params> extends infer PvR
					? PvR extends DbtyperError<any, any>
						? PvR
						: EvR extends SqlTypeShape
							? PvR extends SqlTypeShape
								? MergeLikeOperands<EvR, PvR>
								: FormatError<"INVALID_TILDE_PATTERN", []>
							: FormatError<"INVALID_TILDE_OPERAND", []>
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
			? LvIn extends DbtyperError<any, any>
				? LvIn
				: LvIn extends SqlTypeShape
					? ResolveInListItemsAgainstLeft<LvIn, Ins, Db, Scope, Params>
					: FormatError<"INVALID_IN_LEFT_OPERAND", []>
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
	: FormatError<"INVALID_SCALAR_EXPRESSION", []>

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
	? Params[Name]
	: FormatError<"UNKNOWN_QUERY_PARAMETER", []>

type ResolveIdentChainValue<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> =
	ResolveColumnRefValue<Db, Scope, Parts> extends infer V
		? V extends DbtyperError<any, any>
			? V
			: V extends { sql: infer Sql extends SqlTypeShape }
				? Sql
				: FormatError<"INVALID_COLUMN_REFERENCE", []>
		: never

type ParseFunctionArgsAccum<
	Tokens extends TokensList,
	Env extends ExprParseEnv,
	Acc extends readonly (ScalarExprAst | { kind: "star" })[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Acc]
		: ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer E]
			? E extends DbtyperError<any, any>
				? SkipFailedExpression<R1, E>
				: E extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, E]]
						: PeekToken<R1> extends TokenKey<",">
							? ParseFunctionArgsAccum<SkipToken<R1>, Env, readonly [...Acc, E]>
							: SkipFailedExpression<
									R1,
									FormatError<"EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST", []>
								>
					: never
			: never

type ParseFunctionArgs<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"*">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<")">
				? [SkipToken<R1>, readonly [{ kind: "star" }]]
				: SkipFailedExpression<R1, FormatError<"EXPECTED_CLOSE_PAREN_AFTER_STAR", []>>
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
				: SkipFailedExpression<R1, FormatError<"EXPECTED_OPEN_PAREN_AFTER_OVER", []>>
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
					? PartitionList extends DbtyperError<any, any>
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
											FormatError<"EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY", []>
										>
							: never
					: never
				: SkipFailedExpression<R1, FormatError<"EXPECTED_BY_AFTER_PARTITION", []>>
			: never
		: PeekToken<Tokens> extends TokenKey<"order">
			? ParseWindowOrderByWithoutPartition<Tokens, FnName, Args, Env>
			: SkipFailedExpression<Tokens, FormatError<"EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE", []>>

type ParseWindowOrderByWithoutPartition<
	Tokens extends TokensList,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends TokensList
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [infer R4 extends TokensList, infer OrderList]
				? OrderList extends DbtyperError<any, any>
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
							: SkipFailedExpression<R4, FormatError<"EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE", []>>
						: never
				: never
			: SkipFailedExpression<R3, FormatError<"EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE", []>>
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
				? OrderList extends DbtyperError<any, any>
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
							: SkipFailedExpression<R4, FormatError<"EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE", []>>
						: never
				: never
			: SkipFailedExpression<R3, FormatError<"EXPECTED_BY_AFTER_ORDER", []>>
		: never

type ParseWindowPartitionByList<
	Tokens extends TokensList,
	Env extends ExprParseEnv,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer Expr]
		? Expr extends DbtyperError<any, any>
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
		? Expr extends DbtyperError<any, any>
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
	? FormatError<"USE_IS_NULL_INSTEAD_OF_EQUALS_NULL", []>
	: R["type"] extends "null"
		? FormatError<"USE_IS_NULL_INSTEAD_OF_EQUALS_NULL", []>
		: SameComparisonClass<L, R> extends true
			? SqlBoolean
			: FormatError<"INCOMPATIBLE_TYPES_IN_COMPARISON", []>

/** Simple `CASE expr WHEN value` — each `value` must be `=`-compatible with `expr` (same errors as comparisons). */
type ValidateCaseSimpleWhenMatch<Disc extends SqlTypeShape, WhenV extends SqlTypeShape> =
	MergeComparison<Disc, WhenV> extends DbtyperError<any, any> ? MergeComparison<Disc, WhenV> : true

type MergeBetweenBounds<
	E extends SqlTypeShape,
	Lm extends SqlTypeShape,
	H extends SqlTypeShape,
> = E["type"] extends "null"
	? FormatError<"NULL_NOT_ALLOWED_IN_BETWEEN", []>
	: Lm["type"] extends "null"
		? FormatError<"NULL_NOT_ALLOWED_IN_BETWEEN", []>
		: H["type"] extends "null"
			? FormatError<"NULL_NOT_ALLOWED_IN_BETWEEN", []>
			: SameComparisonClass<E, Lm> extends true
				? SameComparisonClass<E, H> extends true
					? SqlBoolean
					: FormatError<"INCOMPATIBLE_TYPES_IN_BETWEEN", []>
				: FormatError<"INCOMPATIBLE_TYPES_IN_BETWEEN", []>

type MergeLikeOperands<Expr extends SqlTypeShape, Pat extends SqlTypeShape> = Expr["type"] extends "null"
	? FormatError<"NULL_NOT_ALLOWED_IN_LIKE", []>
	: Pat["type"] extends "null"
		? FormatError<"NULL_NOT_ALLOWED_IN_LIKE", []>
		: IsSqlTextType<Expr> extends true
			? IsSqlTextType<Pat> extends true
				? SqlBoolean
				: FormatError<"LIKE_PATTERN_MUST_BE_TEXT", []>
			: FormatError<"LIKE_LEFT_OPERAND_MUST_BE_TEXT", []>

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
					: FormatError<"INCOMPATIBLE_TYPES_IN_CASE", []>
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
		? Wv extends DbtyperError<any, any>
			? Wv
			: Wv extends SqlTypeShape
				? IsSqlBooleanType<Wv> extends true
					? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
						? Tv extends DbtyperError<any, any>
							? Tv
							: Tv extends SqlTypeShape
								? MergeCaseThenAccum<Acc, Tv> extends infer Merged
									? Merged extends DbtyperError<any, any>
										? Merged
										: Merged extends SqlTypeShape
											? ResolveCaseSearchedArms<Rest, ElseB, Db, Scope, Merged, Params>
											: FormatError<"INVALID_CASE_BRANCH", []>
									: never
								: FormatError<"INVALID_CASE_BRANCH", []>
						: never
					: FormatError<"CASE_WHEN_MUST_BE_BOOLEAN", []>
				: FormatError<"CASE_WHEN_MUST_BE_BOOLEAN", []>
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperError<any, any>
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev> extends infer F
						? F extends DbtyperError<any, any>
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: FormatError<"INVALID_CASE_EXPRESSION", []>
						: never
					: FormatError<"INVALID_CASE_ELSE", []>
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: FormatError<"INVALID_CASE_EXPRESSION", []>

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
		? Wv extends DbtyperError<any, any>
			? Wv
			: Wv extends SqlTypeShape
				? ValidateCaseSimpleWhenMatch<Disc, Wv> extends infer Match
					? Match extends DbtyperError<any, any>
						? Match
						: Match extends true
							? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
								? Tv extends DbtyperError<any, any>
									? Tv
									: Tv extends SqlTypeShape
										? MergeCaseThenAccum<Acc, Tv> extends infer Merged
											? Merged extends DbtyperError<any, any>
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
													: FormatError<"INVALID_CASE_BRANCH", []>
											: never
										: FormatError<"INVALID_CASE_BRANCH", []>
								: never
							: never
					: never
				: FormatError<"INVALID_CASE_WHEN_VALUE", []>
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperError<any, any>
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev> extends infer F
						? F extends DbtyperError<any, any>
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: FormatError<"INVALID_CASE_EXPRESSION", []>
						: never
					: FormatError<"INVALID_CASE_ELSE", []>
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: FormatError<"INVALID_CASE_EXPRESSION", []>

type ResolveCaseSimple<
	DiscAst extends ScalarExprAst,
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<DiscAst, Db, Scope, Params> extends infer Dv
		? Dv extends DbtyperError<any, any>
			? Dv
			: Dv extends SqlTypeShape
				? ResolveCaseSimpleArms<Arms, ElseB, Db, Scope, Dv, null, Params>
				: FormatError<"INVALID_CASE_DISCRIMINANT", []>
		: never

/** Per-element check for `expr IN (…)` (same class rules as `=`, but `NULL` list elements are rejected). */
type ValidateInListElement<L extends SqlTypeShape, R extends SqlTypeShape> = L["type"] extends "null"
	? FormatError<"INVALID_IN_LEFT_OPERAND", []>
	: R["type"] extends "null"
		? FormatError<"INCOMPATIBLE_TYPES_IN_IN_LIST", []>
		: SameComparisonClass<L, R> extends true
			? true
			: FormatError<"INCOMPATIBLE_TYPES_IN_IN_LIST", []>

type ResolveInListItemsAgainstLeft<
	Left extends SqlTypeShape,
	Items extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Items extends readonly [infer H extends ScalarExprAst, ...infer Tail extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer Hv
		? Hv extends DbtyperError<any, any>
			? Hv
			: Hv extends SqlTypeShape
				? ValidateInListElement<Left, Hv> extends infer V
					? V extends DbtyperError<any, any>
						? V
						: V extends true
							? Tail extends readonly []
								? SqlBoolean
								: ResolveInListItemsAgainstLeft<Left, Tail, Db, Scope, Params>
							: never
					: never
				: FormatError<"INVALID_IN_LIST_ELEMENT", []>
		: never
	: FormatError<"IN_LIST_MUST_NOT_BE_EMPTY", []>

type ResolveScalarSubquerySel<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["columns"]> extends true
		? keyof S["columns"] extends infer K extends keyof S["columns"]
			? S["columns"][K] extends infer ColType extends SqlTypeShape
				? ColType
				: FormatError<"SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED", []>
			: FormatError<"SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED", []>
		: FormatError<"SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN", []>

type SubSelectColumnAtom<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["columns"]> extends true
		? keyof S["columns"] extends infer K extends keyof S["columns"]
			? S["columns"][K] extends infer ColType extends SqlTypeShape
				? ColType
				: FormatError<"IN_SUBQUERY_COLUMN_INFERENCE_FAILED", []>
			: FormatError<"IN_SUBQUERY_COLUMN_INFERENCE_FAILED", []>
		: FormatError<"IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN", []>

type ResolveInSubqueryAst<
	Lexpr extends ScalarExprAst,
	Sub extends JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<Lexpr, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperError<any, any>
			? Lv
			: Lv extends SqlTypeShape
				? SubSelectColumnAtom<Sub> extends infer Rv
					? Rv extends DbtyperError<any, any>
						? Rv
						: Rv extends SqlTypeShape
							? ValidateInListElement<Lv, Rv> extends infer V
								? V extends DbtyperError<any, any>
									? V
									: V extends true
										? SqlBoolean
										: FormatError<"INCOMPATIBLE_TYPES_IN_IN_SUBQUERY", []>
								: FormatError<"INCOMPATIBLE_TYPES_IN_IN_SUBQUERY", []>
							: FormatError<"INVALID_IN_SUBQUERY_COLUMN", []>
					: FormatError<"INVALID_IN_SUBQUERY_COLUMN", []>
				: FormatError<"INVALID_IN_LEFT_OPERAND", []>
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
		? Lv extends DbtyperError<any, any>
			? Lv
			: Lv extends SqlTypeShape
				? R extends JsqlSelectStatementResult
					? SubSelectColumnAtom<R> extends infer Rv
						? Rv extends DbtyperError<any, any>
							? Rv
							: Rv extends SqlTypeShape
								? MergeComparison<Lv, Rv> extends infer V
									? V extends DbtyperError<any, any>
										? V
										: SqlBoolean
									: FormatError<"INVALID_ANY_ALL_SOME_COMPARISON", []>
								: FormatError<"INVALID_ANY_ALL_SOME_SUBQUERY_COLUMN", []>
						: FormatError<"INVALID_ANY_ALL_SOME_SUBQUERY_COLUMN", []>
					: R extends ScalarExprAst
						? ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
							? Rv extends DbtyperError<any, any>
								? Rv
								: Rv extends SqlTypeShape
									? Rv["type"] extends "array" | "unknown"
										? SqlBoolean
										: FormatError<"ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY", []>
									: FormatError<"INVALID_ANY_ALL_SOME_OPERAND", []>
							: never
						: FormatError<"INVALID_ANY_ALL_SOME_OPERAND", []>
				: FormatError<"INVALID_ANY_ALL_SOME_LEFT_OPERAND", []>
		: never

type MergeBoolNot<V> =
	V extends DbtyperError<any, any>
		? V
		: V extends SqlTypeShape
			? V["type"] extends "null"
				? FormatError<"NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL", []>
				: IsSqlBooleanType<V> extends true
					? SqlBoolean
					: FormatError<"NOT_REQUIRES_BOOLEAN_OPERAND", []>
			: FormatError<"NOT_REQUIRES_BOOLEAN_OPERAND", []>

type MergeBoolBinary<L, R, ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN" | "OR_OPERANDS_MUST_BE_BOOLEAN"> =
	L extends DbtyperError<any, any>
		? L
		: R extends DbtyperError<any, any>
			? R
			: L extends SqlTypeShape
				? R extends SqlTypeShape
					? L["type"] extends "null"
						? FormatError<"NULL_NOT_VALID_BOOLEAN_OPERAND", []>
						: R["type"] extends "null"
							? FormatError<"NULL_NOT_VALID_BOOLEAN_OPERAND", []>
							: IsSqlBooleanType<L> extends true
								? IsSqlBooleanType<R> extends true
									? SqlBoolean
									: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
										? FormatError<"AND_OPERANDS_MUST_BE_BOOLEAN", []>
										: FormatError<"OR_OPERANDS_MUST_BE_BOOLEAN", []>
								: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
									? FormatError<"AND_OPERANDS_MUST_BE_BOOLEAN", []>
									: FormatError<"OR_OPERANDS_MUST_BE_BOOLEAN", []>
					: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
						? FormatError<"AND_OPERANDS_MUST_BE_BOOLEAN", []>
						: FormatError<"OR_OPERANDS_MUST_BE_BOOLEAN", []>
				: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
					? FormatError<"AND_OPERANDS_MUST_BE_BOOLEAN", []>
					: FormatError<"OR_OPERANDS_MUST_BE_BOOLEAN", []>

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
	Tokens extends TokensList,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"]">
		? [SkipToken<Tokens>, Acc]
		: ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends TokensList, infer Ele]
			? Ele extends DbtyperError<any, any>
				? SkipFailedExpression<R1, Ele>
				: Ele extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<"]">
						? [SkipToken<R1>, readonly [...Acc, Ele]]
						: PeekToken<R1> extends TokenKey<",">
							? ParseArrayCtorElementsAccum<SkipToken<R1>, readonly [...Acc, Ele], Env>
							: SkipFailedExpression<
									R1,
									FormatError<"EXPECTED_COMMA_OR_CLOSE_BRACKET_IN_ARRAY_CONSTRUCTOR", []>
								>
					: never
			: never

type ParseArrayCtorAfterArrayKw<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"]">
				? [SkipToken<R1>, { kind: "array_ctor"; elements: readonly [] }]
				: ParseArrayCtorElementsAccum<R1, readonly [], Env> extends [infer R2 extends TokensList, infer Out]
					? Out extends DbtyperError<any, any>
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
				? Idx extends DbtyperError<any, any>
					? SkipFailedExpression<Rj, Idx>
					: Idx extends ScalarExprAst
						? PeekToken<Rj> extends TokenKey<"]">
							? SkipToken<Rj> extends infer Rk extends TokensList
								? ParsePostfixArrayIndexTail<Rk, { kind: "array_index"; base: Acc; index: Idx }, Env>
								: never
							: SkipFailedExpression<Rj, FormatError<"EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT", []>>
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
					? Sub extends DbtyperError<any, any>
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
						? Subw extends DbtyperError<any, any>
							? SkipFailedExpression<Rw, Subw>
							: Subw extends JsqlSelectStatementResult
								? [Rw, { kind: "scalar_subquery"; sel: Subw }]
								: never
						: never
					: ParseOrScalarUntyped<Ri, Env> extends [infer Rj extends TokensList, infer Ej]
						? Ej extends DbtyperError<any, any>
							? SkipFailedExpression<Rj, Ej>
							: PeekToken<Rj> extends infer TokCl
								? SkipToken<Rj> extends infer Rk2 extends TokensList
									? TokCl extends TokenKey<")">
										? [Rk2, Ej]
										: SkipFailedExpression<Rk2, FormatError<"EXPECTED_CLOSE_PAREN", []>>
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
						? ArrOut extends DbtyperError<any, any>
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
												? SkipFailedExpression<Rbad, FormatError<"UNEXPECTED_TOKEN", []>>
												: never

type ParseUnaryScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"-">
		? SkipToken<Tokens> extends infer Rn extends TokensList
			? ParseUnaryScalarUntyped<Rn, Env> extends [infer Ru extends TokensList, infer U]
				? U extends DbtyperError<any, any>
					? SkipFailedExpression<Ru, U>
					: U extends ScalarExprAst
						? [Ru, { kind: "neg"; inner: U }]
						: never
				: never
			: never
		: TryOperandScalarUntyped<Tokens, Env> extends [infer Tu extends TokensList, infer Bu]
			? Bu extends DbtyperError<any, any>
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
				? E1 extends DbtyperError<any, any>
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
				? E1 extends DbtyperError<any, any>
					? SkipFailedExpression<R2, E1>
					: E1 extends ScalarExprAst
						? ParseExpLoop<R2, { kind: "exp"; left: Acc; right: E1 }, Env>
						: never
				: never
			: never
		: [Tokens, Acc]

type ParseExpScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseUnaryScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends DbtyperError<any, any>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ParseExpLoop<R0, E0, Env>
				: never
		: never

type ParseMulScalarUntypedEntry<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseExpScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends DbtyperError<any, any>
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
							? SkipFailedExpression<R0, FormatError<"INCOMPATIBLE_TYPES_IN_ARITHMETIC", []>>
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
						? Rhs extends DbtyperError<any, any>
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
												? Rhs extends DbtyperError<any, any>
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
										: SkipFailedExpression<
												R3,
												FormatError<"EXPECTED_CLOSE_PAREN_AFTER_OPERATOR_OPEN_PAREN", []>
											>
									: never
								: SkipFailedExpression<
										R2,
										FormatError<"EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN", []>
									>
							: never
						: SkipFailedExpression<R1, FormatError<"EXPECTED_OPEN_PAREN_AFTER_OPERATOR", []>>
					: never
				: [Tokens, Acc]
		: [Tokens, Acc]

type ParseOtherOpScalarUntyped<Tokens extends TokensList, Env extends ExprParseEnv> =
	ParseAddScalarUntyped<Tokens, Env> extends [infer R0 extends TokensList, infer E0]
		? E0 extends DbtyperError<any, any>
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
				? E1 extends DbtyperError<any, any>
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
				? E2 extends DbtyperError<any, any>
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
					? Rs extends DbtyperError<any, any>
						? SkipFailedExpression<After, FormatError<"UNBALANCED_PARENTHESES", []>>
						: SkipFailedExpression<
								SkipToken<After>,
								FormatError<"UNSUPPORTED_PARENTHESIZED_EXPRESSION", []>
							>
					: never
				: [Rm, { kind: "alias_table_star"; alias: Al }]
			: Parts extends readonly ["__qts__", infer Sch extends string, infer Tab extends string]
				? PeekToken<Rm> extends TokenKey<"(">
					? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [
							infer After extends TokensList,
							infer Rs,
						]
						? Rs extends DbtyperError<any, any>
							? SkipFailedExpression<After, FormatError<"UNBALANCED_PARENTHESES", []>>
							: SkipFailedExpression<
									SkipToken<After>,
									FormatError<"UNSUPPORTED_PARENTHESIZED_EXPRESSION", []>
								>
						: never
					: [Rm, { kind: "qualified_table_star"; schema: Sch; table: Tab }]
				: Parts extends ScalarIdentParts
					? PeekToken<Rm> extends TokenKey<"(">
						? ParseFunctionArgs<SkipToken<Rm>, Env> extends [infer After extends TokensList, infer Args]
							? Args extends DbtyperError<any, any>
								? SkipFailedExpression<After, Args>
								: Args extends readonly (ScalarExprAst | { kind: "star" })[]
									? Parts extends readonly [infer FnName extends string]
										? ParseOptionalOverClause<After, FnName, Args, Env>
										: SkipFailedExpression<
												After,
												FormatError<"QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED", []>
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
		? E0 extends DbtyperError<any, any>
			? SkipFailedExpression<R0, E0>
			: E0 extends ScalarExprAst
				? ScalarAstNonNumericForMulHead<E0> extends true
					? PeekToken<R0> extends infer P
						? P extends TokenKey<"+"> | TokenKey<"-"> | TokenKey<"*">
							? SkipFailedExpression<R0, FormatError<"INCOMPATIBLE_TYPES_IN_ARITHMETIC", []>>
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
		? Lv extends DbtyperError<any, any>
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperError<any, any>
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? Lv["type"] extends "null"
								? FormatError<"NULL_NOT_ALLOWED_ARITHMETIC", []>
								: Rv["type"] extends "null"
									? FormatError<"NULL_NOT_ALLOWED_ARITHMETIC", []>
									: IsSqlNumericType<Lv["type"]> extends true
										? IsSqlNumericType<Rv["type"]> extends true
											? Lv
											: FormatError<"INCOMPATIBLE_TYPES_IN_ARITHMETIC", []>
										: FormatError<"INCOMPATIBLE_TYPES_IN_ARITHMETIC", []>
							: FormatError<"INVALID_ARITHMETIC_OPERAND", []>
						: FormatError<"INVALID_ARITHMETIC_OPERAND", []>
				: never
		: never

type ResolveScalarExprAstNeg<
	I extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<I, Db, Scope, Params> extends infer U
		? U extends DbtyperError<any, any>
			? U
			: U extends SqlTypeShape
				? IsSqlNumericType<U["type"]> extends true
					? U
					: FormatError<"UNARY_MINUS_REQUIRES_A_NUMBER", []>
				: FormatError<"UNARY_MINUS_REQUIRES_A_NUMBER", []>
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
