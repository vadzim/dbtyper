import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { FromItemsOnly, MarkOuterScope, MergeScope, ScopeMap } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { DbDialectOnlyError } from "../core/dialect.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { MergeSetOperation } from "./set-operation-types.ts"
import type { ParseSelectWithCtes } from "./parse-select-cte.ts"
import type { ParseRawSelectList } from "./parse-select-list.ts"
import type { ParseFromJoinScope } from "./parse-select-from.ts"
import type { ResolveSelectListFrom } from "./parse-select-resolve.ts"
import type { ParseOptionalGroupHaving, SelectGroupClauseMeta } from "./parse-select-group-by.ts"
import type { GroupedProjValidationOutcome } from "./parse-select-grouped.ts"
import type { ParseOptionalOrderByTokens, ParseOptionalPagingTokens } from "./parse-select-order-limit.ts"
import type { ParseDistinctOnList, DistinctOnError } from "./parse-select-distinct-on.ts"
import type { ParseParenEnclosedSelect } from "./parse-select-subquery.ts"

/** Avoid `extends TokenKey<"on">` — the closing `>` can be parsed as a comparison operator. */
export type TokenKeyOn = TokenKey<"on">

/**
 * Third slot of `[Tokens, Mid, Third]` is not correlated with `Mid` under `infer`; it may union with
 * error types from other branches. Strip non-scope constituents before `extends ScopeMap`.
 */
export type JoinScopeOnly<T> = Exclude<T, ParserRefErrorThirdSentinel | DbtyperErrorShape>

export type RawSelectItem =
	| { kind: "star" }
	| { kind: "param"; param: string; as?: string }
	| { kind: "expr"; ast: ScalarExprAst; as?: string; key?: string }

/** SQLT-28: an item's output name before the AST rules: the alias, else the source text kept for dialects with `exprKeys: "text"`. */
export type ItemAs<H> = H extends { as: infer A extends string }
	? A
	: H extends { key: infer K extends string }
		? K
		: undefined

/** With `exactOptionalPropertyTypes`, do not set `as: undefined` — omit the key instead. */
export type RawSelectParamItem<P extends string, As extends string | undefined> = [As] extends [undefined]
	? { kind: "param"; param: P }
	: { kind: "param"; param: P; as: As }

/**
 * Parse SELECT expression (does NOT consume terminator `;`).
 * Use this for SELECT in CREATE VIEW, subqueries, CTEs, etc.
 */
export type ParseSelectExpression<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	OuterScope extends ScopeMap = {},
	CteBase extends ScopeMap = {},
> =
	PeekToken<Tokens> extends TokenIdent<"with">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenIdent<"recursive">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? ParseSelectWithCtes<R2, Db, Params, {}, OuterScope, CteBase, true>
					: never
				: ParseSelectWithCtes<R1, Db, Params, {}, OuterScope, CteBase, false>
			: never
		: ParseSelectCompound<Tokens, Db, Params, CteBase, OuterScope>

/** One SELECT (after the `SELECT` keyword), then any `UNION` / `INTERSECT` / `EXCEPT` arms (CORE-8). */
export type ParseSelectCompound<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
> =
	ParseSelectArm<Tokens, Db, Params, CteBase, OuterScope> extends [
		infer R extends ParserMonad,
		infer Db2 extends JsqlDatabaseShape,
		infer Res,
	]
		? Res extends JsqlSelectStatementResult
			? ParseSetOperationTail<R, Db2, Res, Params, CteBase, OuterScope>
			: [R, Db2, Res]
		: never

/** One SELECT arm after the `SELECT` keyword, with its optional `DISTINCT`. */
export type ParseSelectArm<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
	Trailing extends boolean = true,
> =
	PeekToken<Tokens> extends TokenKey<"distinct">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"on">
				? DbDialectOnlyError<Db, "pg-distinct-on"> extends infer OnlyErr extends DbtyperErrorShape
					? SkipFailedStatement<R0, Db, OnlyErr>
					: ParseDistinctOnList<SkipToken<R0>, Db, Params, OuterScope> extends [
								infer R1 extends ParserMonad,
								infer OnAsts,
						  ]
						? OnAsts extends DbtyperErrorShape
							? SkipFailedStatement<R1, Db, OnAsts>
							: OnAsts extends readonly ScalarExprAst[]
								? ParseSelectAfterDistinct<R1, Db, Params, CteBase, OuterScope, OnAsts, Trailing>
								: never
						: never
				: ParseSelectAfterDistinct<R0, Db, Params, CteBase, OuterScope, readonly [], Trailing>
			: never
		: ParseSelectAfterDistinct<Tokens, Db, Params, CteBase, OuterScope, readonly [], Trailing>

type SetOperationKeyword<T> =
	T extends TokenKey<"union">
		? "UNION"
		: T extends TokenKey<"intersect">
			? "INTERSECT"
			: T extends TokenKey<"except">
				? "EXCEPT"
				: never

export type ParseSetOperationTail<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Left extends JsqlSelectStatementResult,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
	Chained extends boolean = false,
> = [SetOperationKeyword<PeekToken<Tokens>>] extends [never]
	? Chained extends true
		? ParseCompoundTrailing<Tokens, Db, Left, Params>
		: [Tokens, Db, Left]
	: ParseSetOperationRightArm<SkipToken<Tokens>, Db, Params, CteBase, OuterScope> extends [
				infer R extends ParserMonad,
				infer Right,
		  ]
		? Right extends DbtyperErrorShape
			? [R, Db, Right]
			: Right extends JsqlSelectStatementResult
				? MergeSetOperation<Left, Right, SetOperationKeyword<PeekToken<Tokens>>> extends infer Merged
					? Merged extends JsqlSelectStatementResult
						? ParseSetOperationTail<R, Db, Merged, Params, CteBase, OuterScope, true>
						: [R, Db, Merged]
					: never
				: never
		: never

/** After the set operator keyword: optional `ALL` / `DISTINCT`, then `SELECT …`. Returns `[Tokens, Result | error]`. */
export type ParseSetOperationRightArm<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenKey<"all"> | TokenKey<"distinct">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? ParseSetOperationSelect<R0, Db, Params, CteBase, OuterScope>
			: never
		: ParseSetOperationSelect<Tokens, Db, Params, CteBase, OuterScope>

/**
 * `ORDER BY` / paging after the last arm of a set operation belong to the whole compound and see only its output
 * names (SEL-30, SEL-31, CORE-8; #160). Returns `[Tokens, Db, Result | error]`.
 */
export type ParseCompoundTrailing<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Res,
	Params extends ExpressionParamsShape,
> =
	ParseSelectTrailingClauses<Tokens, Db, {}, Params, SelectOutputNames<Res>> extends [
		infer Rt extends ParserMonad,
		infer Te,
	]
		? Te extends DbtyperErrorShape
			? [Rt, Db, Te]
			: [Rt, Db, Res]
		: never

type ParseSetOperationSelect<
	R0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
> =
	PeekToken<R0> extends TokenKey<"(">
		? // #157: a parenthesised arm `UNION (SELECT …)`
			ParseParenEnclosedSelect<SkipToken<R0>, Db, Params, OuterScope, CteBase>
		: PeekToken<R0> extends TokenKey<"select">
			? SkipToken<R0> extends infer R1 extends ParserMonad
				? ParseSelectArm<R1, Db, Params, CteBase, OuterScope, false> extends [
						infer R extends ParserMonad,
						infer _Db2,
						infer Res,
					]
					? [R, Res]
					: never
				: never
			: SkipFailedExpression<R0, FormatError<Errors["EXPECTED_SELECT_AFTER_SET_OPERATOR"], []>>

/**
 * Parse SELECT statement (consumes terminator `;`).
 * Use this for top-level SELECT statements.
 */
export type ParseSelectStatement<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseSelectExpression<Tokens, Db, Params, {}> extends [
		infer R1 extends ParserMonad,
		infer Db2 extends JsqlDatabaseShape,
		infer Res,
	]
		? Res extends DbtyperErrorShape
			? [R1, Db2, Res]
			: PeekToken<R1> extends TokenKey<";"> | TokenEot
				? [SkipToken<R1>, Db2, Res]
				: SkipFailedStatement<R1, Db2, FormatError<Errors["EXPECTED_SEMICOLON"], ["SELECT"]>>
		: never

type SelectListStarInvalid<Items extends readonly RawSelectItem[]> = Items extends readonly [
	{ kind: "star" },
	...infer Rest extends readonly RawSelectItem[],
]
	? Rest extends readonly []
		? false
		: true
	: false

type ParseSelectAfterDistinct<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap = {},
	OuterScope extends ScopeMap = {},
	OnAsts extends readonly ScalarExprAst[] = readonly [],
	Trailing extends boolean = true,
> =
	MergeScope<CteBase, MarkOuterScope<OuterScope>> extends infer MergedOuterScope extends ScopeMap
		? ParseRawSelectList<Tokens, Db, Params, MergedOuterScope> extends [
				infer AfterList extends ParserMonad,
				infer Items,
			]
			? Items extends DbtyperErrorShape
				? [AfterList, Db, Items]
				: Items extends readonly RawSelectItem[]
					? SelectListStarInvalid<Items> extends true
						? [
								AfterList,
								Db,
								FormatError<Errors["SELECT_STAR_MUST_BE_THE_ONLY_PROJECTION_IN_THE_LIST"], []>,
							]
						: PeekToken<AfterList> extends TokenKey<"from">
							? SkipToken<AfterList> extends infer AfterFrom extends ParserMonad
								? ParseFromJoinScope<AfterFrom, Db, CteBase, Params> extends [
										infer R extends ParserMonad,
										infer Mid,
										infer Tail,
									]
									? Mid extends DbtyperErrorShape
										? Tail extends ParserRefErrorThirdSentinel
											? [R, Db, Mid]
											: never
										: Mid extends null
											? [JoinScopeOnly<Tail>] extends [never]
												? never
												: JoinScopeOnly<Tail> extends ScopeMap
													? MergeScope<
															FromItemsOnly<JoinScopeOnly<Tail>>,
															MarkOuterScope<OuterScope>
														> extends infer MergedScope extends ScopeMap
														? ResolveSelectListFrom<
																Items,
																Db,
																FromItemsOnly<JoinScopeOnly<Tail>>,
																MergedScope,
																Params
															> extends infer Res
															? Res extends DbtyperErrorShape
																? [R, Db, WithErrorClause<Res, "SELECT list">]
																: DistinctOnError<
																			OnAsts,
																			Db,
																			MergedScope,
																			Params
																	  > extends infer OnErr extends DbtyperErrorShape
																	? [R, Db, OnErr]
																	: FinishSelectStatement<
																			R,
																			Db,
																			Res,
																			MergedScope,
																			Params,
																			Items,
																			Trailing
																		>
															: never
														: never
													: never
											: never
									: never
								: never
							: PeekToken<AfterList> extends
										| TokenKey<";">
										| TokenKey<")">
										| TokenKey<"union">
										| TokenKey<"intersect">
										| TokenKey<"except">
										| TokenKey<"where">
										| TokenKey<"group">
										| TokenKey<"having">
										| TokenKey<"order">
										| TokenKey<"limit">
										| TokenKey<"offset">
										| TokenKey<"fetch">
										| TokenEot
								? MergeScope<{}, MarkOuterScope<OuterScope>> extends infer MergedScope extends ScopeMap
									? ResolveSelectListFrom<Items, Db, {}, MergedScope, Params> extends infer Res
										? Res extends DbtyperErrorShape
											? [AfterList, Db, WithErrorClause<Res, "SELECT list">]
											: DistinctOnError<
														OnAsts,
														Db,
														MergedScope,
														Params
												  > extends infer OnErr extends DbtyperErrorShape
												? [AfterList, Db, OnErr]
												: FinishSelectStatement<
														AfterList,
														Db,
														Res,
														MergedScope,
														Params,
														Items,
														Trailing
													>
										: never
									: never
								: SkipFailedStatement<
										AfterList,
										Db,
										FormatError<Errors["EXPECTED_FROM_AFTER_SELECT_LIST"], []>
									>
					: never
			: never
		: never

type SelectAfterWhereAndGroupHaving<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Res,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Items extends readonly RawSelectItem[],
	Trailing extends boolean,
> =
	ParseOptionalGroupHaving<Tokens, Db, Scope, Params, Items> extends readonly [
		infer T1 extends ParserMonad,
		infer Gh,
		infer Meta extends SelectGroupClauseMeta,
	]
		? Gh extends DbtyperErrorShape
			? [T1, Db, Gh]
			: GroupedProjValidationOutcome<Db, Items, Meta> extends infer V
				? V extends DbtyperErrorShape
					? [T1, Db, V]
					: Trailing extends false
						? [T1, Db, Res] // an arm after a set operator: ORDER BY / paging belong to the whole compound
						: ParseSelectTrailingClauses<T1, Db, Scope, Params, SelectOutputNames<Res>> extends [
									infer Rt extends ParserMonad,
									infer Te,
							  ]
							? Te extends DbtyperErrorShape
								? [Rt, Db, Te]
								: [PeekToken<T1>, PeekToken<Rt>] extends [
											TokenKey<"order" | "limit" | "offset" | "fetch">,
											SetOperationToken,
									  ]
									? SkipFailedStatement<
											Rt,
											Db,
											FormatError<Errors["ORDER_OR_LIMIT_BEFORE_SET_OPERATOR"], []>
										>
									: [Rt, Db, Res]
							: never
				: never
		: never

type SetOperationToken = TokenKey<"union" | "intersect" | "except">

export type SelectOutputNames<Res> = Res extends { returning: infer Ret } ? keyof Ret & string : never

/** Optional `ORDER BY …` then optional paging; does not change projection type (`Res`). */
export type ParseSelectTrailingClauses<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
> =
	ParseOptionalOrderByTokens<Tokens, Db, Scope, Params, OutNames> extends [infer T1 extends ParserMonad, infer E1]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpression<T1, E1>
			: ParseOptionalPagingTokens<T1, Db, Scope, Params> extends [infer T2 extends ParserMonad, infer E2]
				? E2 extends DbtyperErrorShape
					? SkipFailedExpression<T2, E2>
					: [T2, null]
				: never
		: never

type FinishSelectStatement<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Res,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Items extends readonly RawSelectItem[],
	Trailing extends boolean,
> =
	PeekToken<Tokens> extends TokenKey<"where">
		? SkipToken<Tokens> extends infer Rw0 extends ParserMonad
			? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends ParserMonad, infer We]
				? We extends DbtyperErrorShape
					? [Rw, Db, We]
					: SelectAfterWhereAndGroupHaving<Rw, Db, Res, Scope, Params, Items, Trailing>
				: never
			: never
		: SelectAfterWhereAndGroupHaving<Tokens, Db, Res, Scope, Params, Items, Trailing>
