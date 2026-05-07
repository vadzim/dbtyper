import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlDataShape } from "../core/jsql-shapes.ts"
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
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ParseExpressionAST,
	ResolveExpressionAST,
	SameComparisonClass,
	ScalarExprAst,
	ScalarIdentParts,
} from "./parse-expression.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeEntry, ScopeMap } from "./parser-scope.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"
import type { JsqlDbGetData } from "../core/jsql-utils.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"

/** Avoid `extends TokenKey<"on">` — the closing `>` can be parsed as a comparison operator. */
type TokenKeyOn = TokenKey<"on">

/**
 * Third slot of `[Tokens, Mid, Third]` is not correlated with `Mid` under `infer`; it may union with
 * `SqlParserError` from other branches. Strip non-scope constituents before `extends ScopeMap`.
 */
type JoinScopeOnly<T> = Exclude<T, ParserRefErrorThirdSentinel | SqlParserError<string>>

type RawSelectItem =
	| { kind: "star" }
	| { kind: "param"; param: string; as?: string }
	| { kind: "expr"; ast: ScalarExprAst; as?: string }

/** With `exactOptionalPropertyTypes`, do not set `as: undefined` — omit the key instead. */
type RawSelectParamItem<P extends string, As extends string | undefined> = [As] extends [undefined]
	? { kind: "param"; param: P }
	: { kind: "param"; param: P; as: As }

/**
 * Parse SELECT expression (does NOT consume terminator `;`).
 * Use this for SELECT in CREATE VIEW, subqueries, CTEs, etc.
 */
export type ParseSelectExpression<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<Tokens> extends TokenIdent<"with">
		? ParseSelectWithCtes<SkipToken<Tokens>, Db, Params, OuterScope>
		: PeekToken<Tokens> extends TokenKey<"distinct">
			? ParseSelectAfterDistinct<SkipToken<Tokens>, Db, Params, OuterScope>
			: ParseSelectAfterDistinct<Tokens, Db, Params, OuterScope>

/**
 * Parse SELECT statement (consumes terminator `;`).
 * Use this for top-level SELECT statements.
 */
export type ParseSelectStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseSelectExpression<Tokens, Db, Params, {}> extends [
		infer R1 extends TokensList,
		infer Db2 extends JsqlDatabaseShape,
		infer Res,
	]
		? Res extends SqlParserError<string>
			? [R1, Db2, Res]
			: PeekToken<R1> extends TokenKey<";"> | TokenEot
				? [SkipToken<R1>, Db2, Res]
				: SkipFailedStatement<R1, Db2, SqlParserError<"Expected semicolon after SELECT">>
		: never

type SelectListStarInvalid<Items extends readonly RawSelectItem[]> = Items extends readonly [
	{ kind: "star" },
	...infer Rest extends readonly RawSelectItem[],
]
	? Rest extends readonly []
		? false
		: true
	: false

type ParseSelectWithCtesAfterSubquery<
	R4 extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
	CteName extends string,
	SubOut extends JsqlSelectStatementResult,
> =
	SelectResultToDerivedScopeEntry<SubOut> extends infer Entry extends ScopeEntry
		? MergeScope<Record<CteName, Entry>, Acc> extends infer NextAcc
			? NextAcc extends ScopeMap
				? PeekToken<R4> extends TokenKey<",">
					? ParseSelectWithCtes<SkipToken<R4>, Db, Params, NextAcc>
					: PeekToken<R4> extends TokenKey<"select">
						? ParseSelectAfterDistinct<SkipToken<R4>, Db, Params, NextAcc>
						: SkipFailedStatement<R4, Db, SqlParserError<"Expected SELECT after WITH clause">>
				: never
			: never
		: never

type ParseSelectWithCtes<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
> =
	PeekToken<Tokens> extends infer TokCteName
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? TokCteName extends TokenIdent<infer CteName extends string>
				? CteName extends keyof Acc
					? [R1, Db, SqlParserError<"Duplicate WITH clause name">]
					: PeekToken<R1> extends TokenKey<"as">
						? SkipToken<R1> extends infer R2 extends TokensList
							? PeekToken<R2> extends TokenKey<"(">
								? SkipToken<R2> extends infer R3 extends TokensList
									? ParseParenEnclosedSelect<R3, Db, Params> extends [
											infer R4 extends TokensList,
											infer SubOut,
										]
										? SubOut extends SqlParserError<string>
											? [R4, Db, SubOut]
											: SubOut extends JsqlSelectStatementResult
												? ParseSelectWithCtesAfterSubquery<R4, Db, Params, Acc, CteName, SubOut>
												: never
										: never
									: never
								: SkipFailedExpression<
											R2,
											SqlParserError<"Expected open paren after AS in WITH">
									  > extends [infer Rest extends TokensList, infer Err]
									? [Rest, Db, Err]
									: never
							: never
						: never
				: SkipFailedStatement<R1, Db, SqlParserError<"Expected CTE name in WITH">>
			: never
		: never

type ParseSelectAfterDistinct<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap = {},
> =
	ParseRawSelectList<Tokens, Db, Params, CteBase> extends [infer AfterList extends TokensList, infer Items]
		? Items extends SqlParserError<string>
			? [AfterList, Db, Items]
			: Items extends readonly RawSelectItem[]
				? SelectListStarInvalid<Items> extends true
					? [AfterList, Db, SqlParserError<"SELECT * must be the only projection in the list">]
					: PeekToken<AfterList> extends TokenKey<"from">
						? SkipToken<AfterList> extends infer AfterFrom extends TokensList
							? ParseFromJoinScope<AfterFrom, Db, CteBase, Params> extends [
									infer R extends TokensList,
									infer Mid,
									infer Tail,
								]
								? Mid extends SqlParserError<string>
									? Tail extends ParserRefErrorThirdSentinel
										? [R, Db, Mid]
										: never
									: Mid extends null
										? [JoinScopeOnly<Tail>] extends [never]
											? never
											: JoinScopeOnly<Tail> extends ScopeMap
												? ResolveSelectList<
														Items,
														Db,
														JoinScopeOnly<Tail>,
														Params
													> extends infer Res
													? Res extends SqlParserError<infer _Msg extends string>
														? [R, Db, Res]
														: FinishSelectStatement<
																R,
																Db,
																Res,
																JoinScopeOnly<Tail>,
																Params,
																Items
															>
													: never
												: never
										: never
								: never
							: never
						: PeekToken<AfterList> extends TokenKey<";"> | TokenKey<")"> | TokenEot
							? ResolveSelectList<Items, Db, {}, Params> extends infer Res
								? Res extends SqlParserError<infer _Msg extends string>
									? [AfterList, Db, Res]
									: FinishSelectStatement<AfterList, Db, Res, {}, Params, Items>
								: never
							: SkipFailedStatement<AfterList, Db, SqlParserError<"Expected FROM after SELECT list">>
				: never
		: never

/** Scalar `ORDER BY` / `LIMIT` / `OFFSET` value: any resolved expression (unlike `WHERE`, not restricted to `boolean`). */
type ParseOrderByScalarExpr<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer Rw extends TokensList,
		infer Ast,
	]
		? Ast extends SqlParserError<string>
			? SkipFailedExpression<Rw, Ast>
			: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
				? R extends SqlParserError<string>
					? SkipFailedExpression<Rw, R>
					: R extends SqlTypeShape
						? [Rw, null]
						: SkipFailedExpression<Rw, SqlParserError<"Invalid ORDER BY expression">>
				: never
		: never

type ParseOrderByOneTerm<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseOrderByScalarExpr<Tokens, Db, Scope, Params> extends [infer R1 extends TokensList, infer E1]
		? E1 extends SqlParserError<string>
			? SkipFailedExpression<R1, E1>
			: PeekToken<R1> extends TokenKey<"asc">
				? SkipToken<R1> extends infer R2 extends TokensList
					? [R2, null]
					: never
				: PeekToken<R1> extends TokenKey<"desc">
					? SkipToken<R1> extends infer Rd extends TokensList
						? [Rd, null]
						: never
					: [R1, null]
		: never

type ParseOrderByTerms<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseOrderByOneTerm<Tokens, Db, Scope, Params> extends [infer R1 extends TokensList, infer E1]
		? E1 extends SqlParserError<string>
			? SkipFailedExpression<R1, E1>
			: PeekToken<R1> extends TokenKey<",">
				? SkipToken<R1> extends infer R2 extends TokensList
					? ParseOrderByTerms<R2, Db, Scope, Params>
					: never
				: [R1, null]
		: never

type ParseOrderByAfterOrderKw<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends infer TBy
		? SkipToken<R1> extends infer R2 extends TokensList
			? TBy extends TokenKey<"by">
				? ParseOrderByTerms<R2, Db, Scope, Params>
				: SkipFailedExpression<R2, SqlParserError<"Expected BY after ORDER">>
			: never
		: never

type ParseOptionalOrderByTokens<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"order">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseOrderByAfterOrderKw<R1, Db, Scope, Params>
			: never
		: [Tokens, null]

type LimitExprThenOptionalOffset<
	Rl1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Rl1> extends TokenKey<"offset">
		? SkipToken<Rl1> extends infer Ro0 extends TokensList
			? ParseOrderByScalarExpr<Ro0, Db, Scope, Params> extends [infer Ro1 extends TokensList, infer Oe]
				? Oe extends SqlParserError<string>
					? SkipFailedExpression<Ro1, Oe>
					: [Ro1, null]
				: never
			: never
		: [Rl1, null]

/** After `OFFSET` expr: optional `LIMIT` expr (PostgreSQL allows `OFFSET … LIMIT …`). */
type OffsetExprThenOptionalLimit<
	Ro1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Ro1> extends TokenKey<"limit">
		? SkipToken<Ro1> extends infer Rl0 extends TokensList
			? ParseOrderByScalarExpr<Rl0, Db, Scope, Params> extends [infer Rl1 extends TokensList, infer Le]
				? Le extends SqlParserError<string>
					? SkipFailedExpression<Rl1, Le>
					: [Rl1, null]
				: never
			: never
		: [Ro1, null]

type ExpectRowOrRowsThenOnly<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"rows">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"only">
				? SkipToken<R1> extends infer R2 extends TokensList
					? [R2, null]
					: never
				: SkipFailedExpression<R1, SqlParserError<"Expected ONLY after FETCH … ROWS">>
			: never
		: PeekToken<Tokens> extends TokenKey<"row">
			? SkipToken<Tokens> extends infer R1 extends TokensList
				? PeekToken<R1> extends TokenKey<"only">
					? SkipToken<R1> extends infer R2 extends TokensList
						? [R2, null]
						: never
					: SkipFailedExpression<R1, SqlParserError<"Expected ONLY after FETCH … ROW">>
				: never
			: SkipFailedExpression<Tokens, SqlParserError<"Expected ROW or ROWS in FETCH">>

type ParseFetchFirstAfterFetchKw<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends TokenKey<"first">
		? SkipToken<R1> extends infer R2 extends TokensList
			? ParseOrderByScalarExpr<R2, Db, Scope, Params> extends [infer R3 extends TokensList, infer E]
				? E extends SqlParserError<string>
					? SkipFailedExpression<R3, E>
					: ExpectRowOrRowsThenOnly<R3>
				: never
			: never
		: PeekToken<R1> extends TokenKey<"next">
			? SkipToken<R1> extends infer R2 extends TokensList
				? ParseOrderByScalarExpr<R2, Db, Scope, Params> extends [infer R3 extends TokensList, infer E]
					? E extends SqlParserError<string>
						? SkipFailedExpression<R3, E>
						: ExpectRowOrRowsThenOnly<R3>
					: never
				: never
			: SkipFailedExpression<R1, SqlParserError<"Expected FIRST or NEXT after FETCH">>

/** Optional `LIMIT …` / `OFFSET …` / `FETCH FIRST|NEXT … ROW(S) ONLY` (single paging block). */
type ParseOptionalPagingTokens<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"limit">
		? SkipToken<Tokens> extends infer Rl0 extends TokensList
			? ParseOrderByScalarExpr<Rl0, Db, Scope, Params> extends [infer Rl1 extends TokensList, infer Le]
				? Le extends SqlParserError<string>
					? SkipFailedExpression<Rl1, Le>
					: LimitExprThenOptionalOffset<Rl1, Db, Scope, Params>
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"offset">
			? SkipToken<Tokens> extends infer Ro0 extends TokensList
				? ParseOrderByScalarExpr<Ro0, Db, Scope, Params> extends [infer Ro1 extends TokensList, infer Oe]
					? Oe extends SqlParserError<string>
						? SkipFailedExpression<Ro1, Oe>
						: OffsetExprThenOptionalLimit<Ro1, Db, Scope, Params>
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"fetch">
				? SkipToken<Tokens> extends infer Rf extends TokensList
					? ParseFetchFirstAfterFetchKw<Rf, Db, Scope, Params>
					: never
				: [Tokens, null]

type SelectGroupClauseMeta = {
	readonly have_explicit_group_by: boolean
	readonly has_having_clause: boolean
	readonly group_key_asts: readonly ScalarExprAst[]
}

type GroupByAstResolution<
	R1 extends TokensList,
	Ast extends ScalarExprAst,
	Acc extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Rv
		? Rv extends SqlParserError<string>
			? readonly [R1, { readonly error: Rv }]
			: Rv extends SqlTypeShape
				? PeekToken<R1> extends TokenKey<",">
					? SkipToken<R1> extends infer R2 extends TokensList
						? ParseGroupByTermsAcc<R2, Db, Scope, Params, readonly [...Acc, Ast]>
						: never
					: readonly [R1, { readonly keys: readonly [...Acc, Ast] }]
				: readonly [R1, { readonly error: SqlParserError<"Invalid GROUP BY expression"> }]
		: never

type ParseGroupByTermsAcc<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer R1 extends TokensList,
		infer Ast,
	]
		? Ast extends SqlParserError<string>
			? readonly [R1, { readonly error: Ast }]
			: Ast extends ScalarExprAst
				? GroupByAstResolution<R1, Ast, Acc, Db, Scope, Params>
				: readonly [R1, { readonly error: SqlParserError<"Invalid GROUP BY expression"> }]
		: never

/** After `GROUP BY expr[, …]`; optionally parse `HAVING`. */
type ParseOptionalHavingClauseAfterGroupTerms<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Gbs extends readonly ScalarExprAst[],
> =
	PeekToken<R2> extends TokenKey<"having">
		? SkipToken<R2> extends infer Rh extends TokensList
			? ParseWhereExpression<Rh, Db, Scope, Params> extends [infer Rhw extends TokensList, infer He]
				? He extends SqlParserError<string>
					? readonly [
							Rhw,
							He,
							{
								have_explicit_group_by: false
								has_having_clause: false
								group_key_asts: readonly []
							},
						]
					: readonly [
							Rhw,
							null,
							{
								have_explicit_group_by: true
								has_having_clause: true
								group_key_asts: Gbs
							},
						]
				: never
			: never
		: readonly [
				R2,
				null,
				{
					have_explicit_group_by: true
					has_having_clause: false
					group_key_asts: Gbs
				},
			]

type ParseOptionalHavingWithoutGroupClause<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"having">
		? SkipToken<Tokens> extends infer Rh extends TokensList
			? ParseWhereExpression<Rh, Db, Scope, Params> extends [infer Rhw extends TokensList, infer He]
				? He extends SqlParserError<string>
					? readonly [
							Rhw,
							He,
							{
								have_explicit_group_by: false
								has_having_clause: false
								group_key_asts: readonly []
							},
						]
					: readonly [
							Rhw,
							null,
							{
								have_explicit_group_by: false
								has_having_clause: true
								group_key_asts: readonly []
							},
						]
				: never
			: never
		: readonly [
				Tokens,
				null,
				{
					have_explicit_group_by: false
					has_having_clause: false
					group_key_asts: readonly []
				},
			]

type EmptyGroupClauseMetaPlain = {
	have_explicit_group_by: false
	has_having_clause: false
	group_key_asts: readonly []
}

type ParseGroupTailAfterTerms<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Outcome,
> = Outcome extends { readonly error: infer Ge extends SqlParserError<string> }
	? readonly [R2, Ge, EmptyGroupClauseMetaPlain]
	: Outcome extends { readonly keys: infer Gbs extends readonly ScalarExprAst[] }
		? ParseOptionalHavingClauseAfterGroupTerms<R2, Db, Scope, Params, Gbs> extends readonly [
				infer R3 extends TokensList,
				infer He,
				infer Meta extends SelectGroupClauseMeta,
			]
			? readonly [R3, He, Meta]
			: never
		: never

type ParseOptionalGroupHaving<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"group">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? PeekToken<R0> extends TokenKey<"by">
				? SkipToken<R0> extends infer R1 extends TokensList
					? ParseGroupByTermsAcc<R1, Db, Scope, Params> extends readonly [
							infer R2 extends TokensList,
							infer Outcome,
						]
						? ParseGroupTailAfterTerms<R2, Db, Scope, Params, Outcome>
						: never
					: never
				: readonly [R0, SqlParserError<"Expected BY after GROUP">, EmptyGroupClauseMetaPlain]
			: never
		: ParseOptionalHavingWithoutGroupClause<Tokens, Db, Scope, Params>

type KnownAggregateName<N extends string> =
	Lowercase<N> extends infer L extends string
		? L extends "count" | "sum" | "avg" | "min" | "max"
			? true
			: false
		: false

type TypeBoolAnd<A, B> = A extends true ? (B extends true ? true : false) : false

type AstColPartsMatchGroupKey<KeyAst extends ScalarExprAst, Parts extends ScalarIdentParts> = KeyAst extends {
	kind: "col"
	parts: infer Q extends ScalarIdentParts
}
	? [Q] extends [Parts]
		? true
		: [Parts] extends [Q]
			? true
			: false
	: false

type GroupKeySetContainsColParts<
	Parts extends ScalarIdentParts,
	Keys extends readonly ScalarExprAst[],
> = Keys extends readonly [infer K extends ScalarExprAst, ...infer Rest extends readonly ScalarExprAst[]]
	? AstColPartsMatchGroupKey<K, Parts> extends true
		? true
		: GroupKeySetContainsColParts<Parts, Rest>
	: false

type FnArgsGroupedCheck<
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	GroupKeys extends readonly ScalarExprAst[],
	InsideAgg extends boolean,
> = Args extends readonly [infer A, ...infer R extends readonly (ScalarExprAst | { kind: "star" })[]]
	? A extends { kind: "star" }
		? FnArgsGroupedCheck<R, GroupKeys, InsideAgg>
		: A extends ScalarExprAst
			? ExprValidInsideGroupedSelection<A, GroupKeys, InsideAgg> extends true
				? FnArgsGroupedCheck<R, GroupKeys, InsideAgg>
				: false
			: FnArgsGroupedCheck<R, GroupKeys, InsideAgg>
	: true

type ExprValidInsideGroupedSelection<
	Ast extends ScalarExprAst,
	GroupKeys extends readonly ScalarExprAst[],
	InsideAgg extends boolean,
> = InsideAgg extends true
	? true
	: Ast extends { kind: "true" } | { kind: "false" } | { kind: "sql_null" } | { kind: "string" } | { kind: "number" }
		? true
		: Ast extends { kind: "param" }
			? false
			: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
				? GroupKeySetContainsColParts<P, GroupKeys>
				: Ast extends {
							kind: "function_call"
							name: infer N extends string
							args: infer Args extends readonly (ScalarExprAst | { kind: "star" })[]
					  }
					? KnownAggregateName<N> extends true
						? FnArgsGroupedCheck<Args, GroupKeys, true>
						: FnArgsGroupedCheck<Args, GroupKeys, false>
					: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
						? ExprValidInsideGroupedSelection<I, GroupKeys, false>
						: Ast extends {
									kind: "add"
									left: infer L extends ScalarExprAst
									right: infer R extends ScalarExprAst
							  }
							? TypeBoolAnd<
									ExprValidInsideGroupedSelection<L, GroupKeys, false>,
									ExprValidInsideGroupedSelection<R, GroupKeys, false>
								>
							: Ast extends {
										kind: "sub"
										left: infer Ls extends ScalarExprAst
										right: infer Rs extends ScalarExprAst
								  }
								? TypeBoolAnd<
										ExprValidInsideGroupedSelection<Ls, GroupKeys, false>,
										ExprValidInsideGroupedSelection<Rs, GroupKeys, false>
									>
								: Ast extends {
											kind: "mul"
											left: infer Lm extends ScalarExprAst
											right: infer Rm extends ScalarExprAst
									  }
									? TypeBoolAnd<
											ExprValidInsideGroupedSelection<Lm, GroupKeys, false>,
											ExprValidInsideGroupedSelection<Rm, GroupKeys, false>
										>
									: Ast extends {
												kind: "exp" | "mod"
												left: infer Le extends ScalarExprAst
												right: infer Re extends ScalarExprAst
										  }
										? TypeBoolAnd<
												ExprValidInsideGroupedSelection<Le, GroupKeys, false>,
												ExprValidInsideGroupedSelection<Re, GroupKeys, false>
											>
										: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
											? ExprValidInsideGroupedSelection<In, GroupKeys, false>
											: Ast extends {
														kind: "and" | "or"
														left: infer La extends ScalarExprAst
														right: infer Ra extends ScalarExprAst
												  }
												? TypeBoolAnd<
														ExprValidInsideGroupedSelection<La, GroupKeys, false>,
														ExprValidInsideGroupedSelection<Ra, GroupKeys, false>
													>
												: Ast extends {
															kind: "cmp"
															left: infer Lc extends ScalarExprAst
															right: infer Rc extends ScalarExprAst
													  }
													? TypeBoolAnd<
															ExprValidInsideGroupedSelection<Lc, GroupKeys, false>,
															ExprValidInsideGroupedSelection<Rc, GroupKeys, false>
														>
													: Ast extends {
																kind: "between"
																expr: infer Eb extends ScalarExprAst
																low: infer Lb extends ScalarExprAst
																high: infer Hb extends ScalarExprAst
														  }
														? TypeBoolAnd<
																ExprValidInsideGroupedSelection<Eb, GroupKeys, false>,
																TypeBoolAnd<
																	ExprValidInsideGroupedSelection<
																		Lb,
																		GroupKeys,
																		false
																	>,
																	ExprValidInsideGroupedSelection<
																		Hb,
																		GroupKeys,
																		false
																	>
																>
															>
														: Ast extends {
																	kind: "like" | "pg_regex_match"
																	expr: infer Ex extends ScalarExprAst
																	pattern: infer Pat extends ScalarExprAst
															  }
															? TypeBoolAnd<
																	ExprValidInsideGroupedSelection<
																		Ex,
																		GroupKeys,
																		false
																	>,
																	ExprValidInsideGroupedSelection<
																		Pat,
																		GroupKeys,
																		false
																	>
																>
															: Ast extends {
																		kind: "is_null" | "is_not_null"
																		expr: infer En extends ScalarExprAst
																  }
																? ExprValidInsideGroupedSelection<En, GroupKeys, false>
																: Ast extends {
																			kind: "in_list"
																			expr: infer El extends ScalarExprAst
																			items: infer Ins extends
																				readonly ScalarExprAst[]
																	  }
																	? ExprValidInsideGroupedSelection<
																			El,
																			GroupKeys,
																			false
																		> extends true
																		? Ins extends readonly [
																				infer HIn extends ScalarExprAst,
																				...infer TIn extends
																					readonly ScalarExprAst[],
																			]
																			? ExprValidInsideGroupedSelection<
																					HIn,
																					GroupKeys,
																					false
																				> extends true
																				? TIn extends readonly []
																					? true
																					: ExprValidInsideGroupedSelection<
																							{
																								kind: "in_list"
																								expr: El
																								items: TIn
																							},
																							GroupKeys,
																							false
																						>
																				: false
																			: true
																		: false
																	: Ast extends {
																				kind: "pg_cast" | "sql_cast"
																				expr: infer Xc extends ScalarExprAst
																		  }
																		? ExprValidInsideGroupedSelection<
																				Xc,
																				GroupKeys,
																				false
																			>
																		: Ast extends {
																					kind: "case_simple"
																					discriminant: infer Dsc extends
																						ScalarExprAst
																					arms: infer Arms extends readonly {
																						when: ScalarExprAst
																						then: ScalarExprAst
																					}[]
																					else_: infer El extends
																						ScalarExprAst | null
																			  }
																			? CaseArmsGroupedValid<
																					Arms,
																					GroupKeys
																				> extends true
																				? ExprValidInsideGroupedSelection<
																						Dsc,
																						GroupKeys,
																						false
																					> extends true
																					? El extends ScalarExprAst
																						? ExprValidInsideGroupedSelection<
																								El,
																								GroupKeys,
																								false
																							>
																						: true
																					: false
																				: false
																			: Ast extends {
																						kind: "case_searched"
																						arms: infer Arms2 extends
																							readonly {
																								when: ScalarExprAst
																								then: ScalarExprAst
																							}[]
																						else_: infer El2 extends
																							ScalarExprAst | null
																				  }
																				? CaseArmsGroupedValid<
																						Arms2,
																						GroupKeys
																					> extends true
																					? El2 extends ScalarExprAst
																						? ExprValidInsideGroupedSelection<
																								El2,
																								GroupKeys,
																								false
																							>
																						: true
																					: false
																				: Ast extends {
																							kind: "array_index"
																							base: infer B extends
																								ScalarExprAst
																							index: infer Id extends
																								ScalarExprAst
																					  }
																					? TypeBoolAnd<
																							ExprValidInsideGroupedSelection<
																								B,
																								GroupKeys,
																								false
																							>,
																							ExprValidInsideGroupedSelection<
																								Id,
																								GroupKeys,
																								false
																							>
																						>
																					: Ast extends {
																								kind: "array_ctor"
																								elements: infer Els extends
																									readonly ScalarExprAst[]
																						  }
																						? ArrayCtorEltsGroupedValid<
																								Els,
																								GroupKeys
																							>
																						: Ast extends {
																									kind: "custom_op"
																									left: infer Lc extends
																										ScalarExprAst
																									right: infer Rc extends
																										ScalarExprAst
																							  }
																							? TypeBoolAnd<
																									ExprValidInsideGroupedSelection<
																										Lc,
																										GroupKeys,
																										false
																									>,
																									ExprValidInsideGroupedSelection<
																										Rc,
																										GroupKeys,
																										false
																									>
																								>
																							: Ast extends {
																										kind: "in_subquery"
																										expr: infer Ie extends
																											ScalarExprAst
																								  }
																								? ExprValidInsideGroupedSelection<
																										Ie,
																										GroupKeys,
																										false
																									>
																								: Ast extends {
																											kind:
																												| "scalar_subquery"
																												| "exists_subquery"
																									  }
																									? true
																									: false

type CaseArmsGroupedValid<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	GroupKeys extends readonly ScalarExprAst[],
> = Arms extends readonly [
	infer Arm extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly {
		when: ScalarExprAst
		then: ScalarExprAst
	}[],
]
	? TypeBoolAnd<
			TypeBoolAnd<
				ExprValidInsideGroupedSelection<Arm["when"], GroupKeys, false>,
				ExprValidInsideGroupedSelection<Arm["then"], GroupKeys, false>
			>,
			Rest extends readonly [] ? true : CaseArmsGroupedValid<Rest, GroupKeys>
		>
	: true

type ArrayCtorEltsGroupedValid<
	Els extends readonly ScalarExprAst[],
	GroupKeys extends readonly ScalarExprAst[],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ExprValidInsideGroupedSelection<H, GroupKeys, false> extends true
		? T extends readonly []
			? true
			: ArrayCtorEltsGroupedValid<T, GroupKeys>
		: false
	: true

type AstContainsAggregateCall<Ast extends ScalarExprAst> = Ast extends {
	kind: "function_call"
	name: infer N extends string
}
	? KnownAggregateName<N> extends true
		? true
		: false
	: Ast extends {
				kind: "add" | "sub" | "mul" | "exp" | "mod"
				left: infer L extends ScalarExprAst
				right: infer R extends ScalarExprAst
		  }
		? AstContainsAggregateCall<L> extends true
			? true
			: AstContainsAggregateCall<R>
		: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
			? AstContainsAggregateCall<I>
			: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
				? AstContainsAggregateCall<In>
				: Ast extends {
							kind: "and" | "or" | "cmp"
							left: infer La extends ScalarExprAst
							right: infer Ra extends ScalarExprAst
					  }
					? AstContainsAggregateCall<La> extends true
						? true
						: AstContainsAggregateCall<Ra>
					: Ast extends {
								kind: "between"
								expr: infer Eb extends ScalarExprAst
								low: infer Lb extends ScalarExprAst
								high: infer Hb extends ScalarExprAst
						  }
						? AstContainsAggregateCall<Eb> extends true
							? true
							: AstContainsAggregateCall<Lb> extends true
								? true
								: AstContainsAggregateCall<Hb>
						: Ast extends {
									kind: "like" | "pg_regex_match"
									expr: infer Ex extends ScalarExprAst
									pattern: infer Pat extends ScalarExprAst
							  }
							? AstContainsAggregateCall<Ex> extends true
								? true
								: AstContainsAggregateCall<Pat>
							: Ast extends { kind: "is_null" | "is_not_null"; expr: infer En extends ScalarExprAst }
								? AstContainsAggregateCall<En>
								: Ast extends {
											kind: "in_list"
											expr: infer El extends ScalarExprAst
											items: infer Ins extends readonly ScalarExprAst[]
									  }
									? AstContainsAggregateCall<El> extends true
										? true
										: Ins extends readonly [
													infer H extends ScalarExprAst,
													...infer T extends readonly ScalarExprAst[],
											  ]
											? AstContainsAggregateCall<H> extends true
												? true
												: T extends readonly []
													? false
													: AstContainsAggregateCall<{ kind: "in_list"; expr: El; items: T }>
											: false
									: Ast extends {
												kind: "pg_cast" | "sql_cast"
												expr: infer Ex2 extends ScalarExprAst
										  }
										? AstContainsAggregateCall<Ex2>
										: Ast extends {
													kind: "case_simple"
													discriminant: infer D extends ScalarExprAst
													arms: infer Arms extends readonly {
														when: ScalarExprAst
														then: ScalarExprAst
													}[]
													else_: infer Elc extends ScalarExprAst | null
											  }
											? AstContainsAggregateCall<D> extends true
												? true
												: CaseArmsContainAgg<Arms> extends true
													? true
													: Elc extends ScalarExprAst
														? AstContainsAggregateCall<Elc>
														: false
											: Ast extends {
														kind: "case_searched"
														arms: infer Arms2 extends readonly {
															when: ScalarExprAst
															then: ScalarExprAst
														}[]
														else_: infer Elc2 extends ScalarExprAst | null
												  }
												? CaseArmsContainAgg<Arms2> extends true
													? true
													: Elc2 extends ScalarExprAst
														? AstContainsAggregateCall<Elc2>
														: false
												: Ast extends {
															kind: "array_index"
															base: infer B extends ScalarExprAst
															index: infer Id extends ScalarExprAst
													  }
													? AstContainsAggregateCall<B> extends true
														? true
														: AstContainsAggregateCall<Id>
													: Ast extends {
																kind: "array_ctor"
																elements: infer Els extends readonly ScalarExprAst[]
														  }
														? ArrayCtorContainsAgg<Els>
														: Ast extends {
																	kind: "custom_op"
																	left: infer Lc extends ScalarExprAst
																	right: infer Rc extends ScalarExprAst
															  }
															? AstContainsAggregateCall<Lc> extends true
																? true
																: AstContainsAggregateCall<Rc>
															: Ast extends {
																		kind: "in_subquery"
																		expr?: infer Lex extends ScalarExprAst
																  }
																? Lex extends ScalarExprAst
																	? AstContainsAggregateCall<Lex>
																	: false
																: false

type CaseArmsContainAgg<Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[]> = Arms extends readonly [
	infer Arm extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly {
		when: ScalarExprAst
		then: ScalarExprAst
	}[],
]
	? AstContainsAggregateCall<Arm["when"]> extends true
		? true
		: AstContainsAggregateCall<Arm["then"]> extends true
			? true
			: Rest extends readonly []
				? false
				: CaseArmsContainAgg<Rest>
	: false

type ArrayCtorContainsAgg<Els extends readonly ScalarExprAst[]> = Els extends readonly [
	infer H extends ScalarExprAst,
	...infer T extends readonly ScalarExprAst[],
]
	? AstContainsAggregateCall<H> extends true
		? true
		: T extends readonly []
			? false
			: ArrayCtorContainsAgg<T>
	: false

type SelectItemsNeedGroupedProjRules<
	Meta extends SelectGroupClauseMeta,
	Items extends readonly RawSelectItem[],
> = Meta["has_having_clause"] extends true
	? true
	: Meta["have_explicit_group_by"] extends true
		? true
		: RawSelectItemsHaveAggregateCall<Items>

type RawSelectItemsHaveAggregateCall<Items extends readonly RawSelectItem[]> = Items extends readonly [
	infer H extends RawSelectItem,
	...infer R extends readonly RawSelectItem[],
]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? AstContainsAggregateCall<Ast> extends true
			? true
			: RawSelectItemsHaveAggregateCall<R>
		: RawSelectItemsHaveAggregateCall<R>
	: false

type ValidateGroupedSelectItemsAgainstKeys<
	Items extends readonly RawSelectItem[],
	GroupKeys extends readonly ScalarExprAst[],
> = Items extends readonly [infer H extends RawSelectItem, ...infer Rest extends readonly RawSelectItem[]]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? ExprValidInsideGroupedSelection<Ast, GroupKeys, false> extends true
			? ValidateGroupedSelectItemsAgainstKeys<Rest, GroupKeys>
			: SqlParserError<"Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">
		: H extends { kind: "star" } | { kind: "param" }
			? ValidateGroupedSelectItemsAgainstKeys<Rest, GroupKeys>
			: never
	: true

type GroupedProjValidationOutcome<Items extends readonly RawSelectItem[], Meta extends SelectGroupClauseMeta> =
	SelectItemsNeedGroupedProjRules<Meta, Items> extends true
		? ValidateGroupedSelectItemsAgainstKeys<Items, Meta["group_key_asts"]>
		: true

type SelectAfterWhereAndGroupHaving<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Res,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Items extends readonly RawSelectItem[],
> =
	ParseOptionalGroupHaving<Tokens, Db, Scope, Params> extends readonly [
		infer T1 extends TokensList,
		infer Gh,
		infer Meta extends SelectGroupClauseMeta,
	]
		? Gh extends SqlParserError<string>
			? [T1, Db, Gh]
			: GroupedProjValidationOutcome<Items, Meta> extends infer V
				? V extends SqlParserError<string>
					? [T1, Db, V]
					: ParseSelectTrailingClauses<T1, Db, Scope, Params> extends [infer Rt extends TokensList, infer Te]
						? Te extends SqlParserError<string>
							? [Rt, Db, Te]
							: [Rt, Db, Res]
						: never
				: never
		: never

/** Optional `ORDER BY …` then optional paging; does not change projection type (`Res`). */
type ParseSelectTrailingClauses<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseOptionalOrderByTokens<Tokens, Db, Scope, Params> extends [infer T1 extends TokensList, infer E1]
		? E1 extends SqlParserError<string>
			? SkipFailedExpression<T1, E1>
			: ParseOptionalPagingTokens<T1, Db, Scope, Params> extends [infer T2 extends TokensList, infer E2]
				? E2 extends SqlParserError<string>
					? SkipFailedExpression<T2, E2>
					: [T2, null]
				: never
		: never

type FinishSelectStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Res,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Items extends readonly RawSelectItem[],
> =
	PeekToken<Tokens> extends TokenKey<"where">
		? SkipToken<Tokens> extends infer Rw0 extends TokensList
			? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends TokensList, infer We]
				? We extends SqlParserError<string>
					? [Rw, Db, We]
					: SelectAfterWhereAndGroupHaving<Rw, Db, Res, Scope, Params, Items>
				: never
			: never
		: SelectAfterWhereAndGroupHaving<Tokens, Db, Res, Scope, Params, Items>

type ParseRawSelectList<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
	Acc extends readonly RawSelectItem[] = [],
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? [Tokens, Acc]
		: PeekToken<Tokens> extends TokenKey<"*">
			? ParseRawSelectListAfterItem<SkipToken<Tokens>, Db, Params, OuterScope, [...Acc, { kind: "star" }]>
			: ParseOneRawSelectItem<Tokens, Db, Params, OuterScope> extends [
						infer AfterItem extends TokensList,
						infer It,
				  ]
				? It extends SqlParserError<string>
					? SkipFailedExpression<AfterItem, It>
					: It extends RawSelectItem
						? ParseRawSelectListAfterItem<AfterItem, Db, Params, OuterScope, [...Acc, It]>
						: never
				: never

type ParseRawSelectListAfterItem<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	Acc extends readonly RawSelectItem[],
> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseRawSelectList<SkipToken<Tokens>, Db, Params, OuterScope, Acc>
		: [Tokens, Acc]

type ParseOneRawSelectExprItem<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: OuterScope }> extends [
		infer RExpr extends TokensList,
		infer Out,
	]
		? Out extends SqlParserError<infer _Msg extends string>
			? [RExpr, Out]
			: Out extends ScalarExprAst
				? ParseOptionalAs<RExpr> extends [infer M2 extends TokensList, infer As extends string | undefined]
					? As extends string
						? [M2, { kind: "expr"; ast: Out; as: As }]
						: Out extends { kind: "col"; parts: ScalarIdentParts }
							? [M2, { kind: "expr"; ast: Out }]
							: [M2, { kind: "expr"; ast: Out }]
					: never
				: never
		: never

type ParseOneRawSelectItem<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenParam<infer P extends string>
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? ParseOptionalAs<R1> extends [infer M2 extends TokensList, infer As extends string | undefined]
				? [M2, RawSelectParamItem<P, As>]
				: never
			: never
		: PeekToken<Tokens> extends TokenIdent<string>
			? ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope>
			: PeekToken<Tokens> extends infer Head
				? Head extends
						| TokenKey<"(">
						| TokenNumber<string>
						| TokenString<string>
						| TokenKey<"true">
						| TokenKey<"false">
						| TokenKey<"null">
						| TokenKey<"-">
						| TokenKey<"not">
						| TokenKey<"cast">
						| TokenKey<"case">
						| TokenKey<"exists">
						| TokenKey<"array">
					? ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope>
					: never
				: never

type ParseOptionalAs<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"as">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenIdent<infer N extends string>
				? SkipToken<R1> extends infer R2 extends TokensList
					? [R2, N]
					: never
				: SkipToken<R1> extends infer R2b extends TokensList
					? [R2b, undefined]
					: never
			: SkipToken<Tokens> extends infer R1b extends TokensList
				? [R1b, undefined]
				: never
		: [Tokens, undefined]

/** Row shape of a parsed inner `SELECT` used as a derived table in `FROM` / `JOIN`. */
type SelectResultToDerivedScopeEntry<Res extends JsqlSelectStatementResult> = {
	schema: "__subquery__"
	table: "__subquery__"
	columns: Res["columns"]
}

type _ParseAliasAfterDerivedTable<
	Tokens extends TokensList,
	_Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Res extends JsqlSelectStatementResult,
> =
	SelectResultToDerivedScopeEntry<Res> extends infer Entry extends ScopeEntry
		? PeekToken<Tokens> extends
				| TokenKey<"inner">
				| TokenKey<"left">
				| TokenKey<"cross">
				| TokenKey<"join">
				| TokenKey<"where">
				| TokenKey<";">
				| TokenEot
			? [Tokens, SqlParserError<"Expected AS or alias after derived table">, ParserRefErrorThirdSentinel]
			: PeekToken<Tokens> extends TokenKey<"as">
				? SkipToken<Tokens> extends infer Ras0 extends TokensList
					? PeekToken<Ras0> extends infer TokName
						? SkipToken<Ras0> extends infer Ra extends TokensList
							? TokName extends TokenIdent<infer Alias extends string>
								? [Ra, null, MergeScope<Record<Alias, Entry>, OuterScope>]
								: [Ra, SqlParserError<"Expected alias name after AS">, ParserRefErrorThirdSentinel]
							: never
						: never
					: never
				: PeekToken<Tokens> extends infer TokAlias
					? SkipToken<Tokens> extends infer Ra extends TokensList
						? TokAlias extends TokenIdent<infer Alias extends string>
							? [Ra, null, MergeScope<Record<Alias, Entry>, OuterScope>]
							: [Ra, SqlParserError<"Expected alias after derived table">, ParserRefErrorThirdSentinel]
						: never
					: never
		: never

/** Helper: Consume closing `)` after subquery. Returns [Tokens, Result] or error. */
type ConsumeClosingParen<Tokens extends TokensList, Result> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Result]
		: Result extends JsqlSelectStatementResult
			? SkipFailedExpression<Tokens, SqlParserError<"Expected `)` after subquery">>
			: [Tokens, SqlParserError<"Expected `)` after subquery">]

/** Helper: Validate that a SELECT result has exactly one column (for scalar subqueries). */
type ValidateSingleColumn<Result extends JsqlSelectStatementResult> = Result["columns"] extends infer Cols
	? [keyof Cols] extends [infer K]
		? K extends string
			? Result
			: SqlParserError<"Scalar subquery must project exactly one column">
		: SqlParserError<"Scalar subquery must project exactly one column">
	: SqlParserError<"Invalid subquery result">

/** Helper: Parse alias after derived table and merge into scope. Returns [Tokens, null, Scope] or error. */
type ParseAliasAfterDerived<
	Tokens extends TokensList,
	_Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Result extends JsqlSelectStatementResult,
> =
	SelectResultToDerivedScopeEntry<Result> extends infer Entry extends ScopeEntry
		? PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras extends TokensList
				? PeekToken<Ras> extends TokenIdent<infer Alias extends string>
					? [SkipToken<Ras>, null, MergeScope<Record<Alias, Entry>, OuterScope>]
					: [SkipToken<Ras>, SqlParserError<"Expected alias name after AS">, ParserRefErrorThirdSentinel]
				: never
			: PeekToken<Tokens> extends TokenIdent<infer Alias extends string>
				? [SkipToken<Tokens>, null, MergeScope<Record<Alias, Entry>, OuterScope>]
				: [Tokens, SqlParserError<"Expected alias after derived table">, ParserRefErrorThirdSentinel]
		: never

/** Inner `( SELECT … FROM … [WHERE …] )` ending with `)`; multi-column allowed (`EXISTS`, CTE, `IN (SELECT …)`). */
export type ParseParenEnclosedSelect<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, OuterScope> extends [
				infer R2 extends TokensList,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends SqlParserError<string>
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result>
					: never
			: never
		: SkipFailedExpression<R1, SqlParserError<"Expected SELECT in subquery">>

/** Scalar subquery: exactly one non-`*` projection. */
export type ParseParenScalarSelect<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, OuterScope> extends [
				infer R2 extends TokensList,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends SqlParserError<string>
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ValidateSingleColumn<Result> extends infer Validated
						? Validated extends SqlParserError<string>
							? SkipFailedExpression<R2, Validated>
							: ConsumeClosingParen<R2, Validated>
						: never
					: never
			: never
		: SkipFailedExpression<R1, SqlParserError<"Expected SELECT in subquery">>

type ParseParenDerivedSelect<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, {}> extends [
				infer R2 extends TokensList,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends SqlParserError<string>
				? [R2, Result, ParserRefErrorThirdSentinel]
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result> extends [infer R3 extends TokensList, infer Validated]
						? Validated extends SqlParserError<string>
							? [R3, Validated, ParserRefErrorThirdSentinel]
							: Validated extends JsqlSelectStatementResult
								? ParseAliasAfterDerived<R3, Db, OuterScope, Validated>
								: never
						: never
					: never
			: never
		: [R1, SqlParserError<"Expected SELECT in derived table">, ParserRefErrorThirdSentinel]

type ParseFromTableRef<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? Tok extends TokenKey<"(">
				? ParseParenDerivedSelect<R1, Db, Scope, Params>
				: Tok extends TokenIdent<infer A extends string>
					? ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
					: [R1, SqlParserError<"Expected table name or `(` in FROM">, ParserRefErrorThirdSentinel]
			: never
		: never

type ParseFromJoinScope<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseFromTableRef<Tokens, Db, Scope, Params> extends [infer R0 extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
			? Third extends ParserRefErrorThirdSentinel
				? [R0, Mid, ParserRefErrorThirdSentinel]
				: never
			: Mid extends null
				? [JoinScopeOnly<Third>] extends [never]
					? never
					: JoinScopeOnly<Third> extends ScopeMap
						? ParseJoinChain<R0, Db, JoinScopeOnly<Third>, Params>
						: never
				: never
		: never

type ParseFromTableAfterLeadingIdent<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	A extends string,
	Scope extends ScopeMap,
> =
	PeekToken<R1> extends TokenKey<".">
		? SkipToken<R1> extends infer R2 extends TokensList
			? PeekToken<R2> extends infer TokB
				? SkipToken<R2> extends infer R3 extends TokensList
					? TokB extends TokenIdent<infer B extends string>
						? JsqlDbGetData<Db, A, B> extends infer Tbl extends JsqlDataShape
							? ParseAliasAfterTable<R3, A, B, Tbl, Scope>
							: [R3, SqlParserError<"Unknown schema or table in FROM">, ParserRefErrorThirdSentinel]
						: [R3, SqlParserError<"Expected table name after `.` in FROM">, ParserRefErrorThirdSentinel]
					: never
				: never
			: never
		: A extends keyof Scope
			? ParseAliasAfterCTE<R1, A, Scope[A], Scope>
			: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer Tbl extends JsqlDataShape
				? ParseAliasAfterTable<R1, Db["defaultSchema"], A, Tbl, Scope>
				: [R1, SqlParserError<"Unknown table in FROM">, ParserRefErrorThirdSentinel]

type ParseAliasAfterCTE<
	Tokens extends TokensList,
	CteName extends string,
	CteEntry extends ScopeEntry,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends
		| TokenKey<"inner">
		| TokenKey<"left">
		| TokenKey<"right">
		| TokenKey<"full">
		| TokenKey<"cross">
		| TokenKey<"join">
		| TokenKey<"on">
		| TokenKey<"where">
		| TokenKey<"order">
		| TokenKey<"limit">
		| TokenKey<"offset">
		| TokenKey<"fetch">
		| TokenKey<"group">
		| TokenKey<"having">
		| TokenKey<")">
		| TokenKey<";">
		| TokenEot
		? [Tokens, null, MergeScope<Record<CteName, CteEntry>, Scope>]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras0 extends TokensList
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends TokensList
						? TokName extends TokenIdent<infer Alias extends string>
							? [Ra, null, MergeScope<Record<Alias, CteEntry>, Scope>]
							: [Ra, SqlParserError<"Expected alias name after AS">, ParserRefErrorThirdSentinel]
						: never
					: never
				: never
			: PeekToken<Tokens> extends infer TokAlias
				? SkipToken<Tokens> extends infer Ra extends TokensList
					? TokAlias extends TokenIdent<infer Alias extends string>
						? [Ra, null, MergeScope<Record<Alias, CteEntry>, Scope>]
						: [Ra, SqlParserError<"Expected alias after CTE">, ParserRefErrorThirdSentinel]
					: never
				: never

type ParseAliasAfterTable<
	Tokens extends TokensList,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends
		| TokenKey<"inner">
		| TokenKey<"left">
		| TokenKey<"right">
		| TokenKey<"full">
		| TokenKey<"cross">
		| TokenKey<"join">
		| TokenKey<"on">
		| TokenKey<"where">
		| TokenKey<"order">
		| TokenKey<"limit">
		| TokenKey<"offset">
		| TokenKey<"fetch">
		| TokenKey<"group">
		| TokenKey<"having">
		| TokenKey<")">
		| TokenKey<";">
		| TokenEot
		? [
				Tokens,
				null,
				MergeScope<
					Record<
						Tab,
						{
							schema: Sch
							table: Tab
							columns: Tbl["columns"]
						}
					>,
					Scope
				>,
			]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras0 extends TokensList
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends TokensList
						? TokName extends TokenIdent<infer Alias extends string>
							? [
									Ra,
									null,
									MergeScope<
										Record<
											Alias,
											{
												schema: Sch
												table: Tab
												columns: Tbl["columns"]
											}
										>,
										Scope
									>,
								]
							: [Ra, SqlParserError<"Expected alias name after AS">, ParserRefErrorThirdSentinel]
						: never
					: never
				: never
			: PeekToken<Tokens> extends infer TokAlias
				? SkipToken<Tokens> extends infer Ra extends TokensList
					? TokAlias extends TokenIdent<infer Alias extends string>
						? [
								Ra,
								null,
								MergeScope<
									Record<
										Alias,
										{
											schema: Sch
											table: Tab
											columns: Tbl["columns"]
										}
									>,
									Scope
								>,
							]
						: [Ra, SqlParserError<"Expected alias or join clause after table">, ParserRefErrorThirdSentinel]
					: never
				: never

type ParseJoinChain<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"inner">
		? ParseJoinAfterOptionalInner<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"left">
			? ParseJoinAfterLeft<SkipToken<Tokens>, Db, Scope, Params>
			: PeekToken<Tokens> extends TokenKey<"right">
				? ParseJoinAfterRight<SkipToken<Tokens>, Db, Scope, Params>
				: PeekToken<Tokens> extends TokenKey<"full">
					? ParseJoinAfterFull<SkipToken<Tokens>, Db, Scope, Params>
					: PeekToken<Tokens> extends TokenKey<"cross">
						? ParseJoinAfterCross<SkipToken<Tokens>, Db, Scope, Params>
						: PeekToken<Tokens> extends TokenKey<"join">
							? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
							: [Tokens, null, Scope]

type ParseJoinAfterCross<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? SkipToken<Tokens> extends infer AfterJ extends TokensList
			? ParseFromTableRef<AfterJ, Db, Scope, Params> extends [infer R0 extends TokensList, infer Mid, infer Third]
				? Mid extends SqlParserError<string>
					? Third extends ParserRefErrorThirdSentinel
						? [R0, Mid, ParserRefErrorThirdSentinel]
						: never
					: Mid extends null
						? [JoinScopeOnly<Third>] extends [never]
							? never
							: JoinScopeOnly<Third> extends ScopeMap
								? ParseJoinChain<R0, Db, JoinScopeOnly<Third>, Params>
								: never
						: never
				: never
			: never
		: [Tokens, SqlParserError<"Expected JOIN after CROSS">, ParserRefErrorThirdSentinel]

type ParseJoinAfterOptionalInner<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, SqlParserError<"Expected JOIN after INNER">, ParserRefErrorThirdSentinel]

type ParseJoinAfterLeft<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterOptionalOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
			: [Tokens, SqlParserError<"Expected OUTER or JOIN after LEFT">, ParserRefErrorThirdSentinel]

type ParseJoinAfterRight<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterRightOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
			: [Tokens, SqlParserError<"Expected OUTER or JOIN after RIGHT">, ParserRefErrorThirdSentinel]

type ParseJoinAfterRightOuter<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, SqlParserError<"Expected JOIN after RIGHT OUTER">, ParserRefErrorThirdSentinel]

type ParseJoinAfterFull<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterFullOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
			: [Tokens, SqlParserError<"Expected OUTER or JOIN after FULL">, ParserRefErrorThirdSentinel]

type ParseJoinAfterFullOuter<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, SqlParserError<"Expected JOIN after FULL OUTER">, ParserRefErrorThirdSentinel]

type ParseJoinAfterOptionalOuter<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, SqlParserError<"Expected JOIN after LEFT OUTER">, ParserRefErrorThirdSentinel]

type ParseJoinAfterJoinKw<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? SkipToken<Tokens> extends infer AfterJ extends TokensList
			? ParseFromTableRef<AfterJ, Db, Scope, Params> extends [infer R0 extends TokensList, infer Mid, infer Third]
				? Mid extends SqlParserError<string>
					? Third extends ParserRefErrorThirdSentinel
						? [R0, Mid, ParserRefErrorThirdSentinel]
						: never
					: Mid extends null
						? [JoinScopeOnly<Third>] extends [never]
							? never
							: JoinScopeOnly<Third> extends ScopeMap
								? PeekToken<R0> extends TokenKeyOn
									? ParseJoinOn<R0, Db, JoinScopeOnly<Third>, Params>
									: [R0, SqlParserError<"Expected ON after JOIN table">, ParserRefErrorThirdSentinel]
								: [R0, SqlParserError<"Expected ON after JOIN table">, ParserRefErrorThirdSentinel]
						: never
				: never
			: never
		: [Tokens, SqlParserError<"Expected JOIN keyword">, ParserRefErrorThirdSentinel]

type ParseJoinOn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends infer TokOn
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? TokOn extends TokenKeyOn
				? ParseJoinEqPair<R1, Db, Scope> extends [infer R2 extends TokensList, infer Tag]
					? Tag extends SqlParserError<string>
						? [R2, Tag, ParserRefErrorThirdSentinel]
						: Tag extends true
							? ParseJoinChain<R2, Db, Scope, Params>
							: never
					: never
				: [R1, SqlParserError<"Expected ON keyword">, ParserRefErrorThirdSentinel]
			: never
		: never

/** Both sides of `ON` are `schema.table.column`; validate against catalog. */
type JoinOnQualifiedEqOk<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	L extends readonly [string, string, string],
	R extends readonly [string, string, string],
> =
	ResolveColumnRefValue<Db, Scope, L> extends SqlParserError<string>
		? SqlParserError<`Unknown column in JOIN ON (left): ${L[0]}.${L[1]}.${L[2]}`>
		: ResolveColumnRefValue<Db, Scope, R> extends SqlParserError<string>
			? SqlParserError<`Unknown column in JOIN ON (right): ${R[0]}.${R[1]}.${R[2]}`>
			: ResolveColumnRefValue<Db, Scope, L> extends { sql: infer Ls extends SqlTypeShape }
				? ResolveColumnRefValue<Db, Scope, R> extends { sql: infer Rs extends SqlTypeShape }
					? SameComparisonClass<Ls, Rs> extends true
						? true
						: SqlParserError<"Incompatible types in JOIN ON">
					: SqlParserError<`Unknown column in JOIN ON (right): ${R[0]}.${R[1]}.${R[2]}`>
				: SqlParserError<`Unknown column in JOIN ON (left): ${L[0]}.${L[1]}.${L[2]}`>

type JoinOnAliasEqOk<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	LeftAlias extends string,
	LeftCol extends string,
	RightAlias extends string,
	RightCol extends string,
> =
	ResolveColumnRefValue<Db, Scope, readonly [LeftAlias, LeftCol]> extends SqlParserError<string>
		? SqlParserError<`Unknown column in JOIN (left side): ${LeftAlias}.${LeftCol}`>
		: ResolveColumnRefValue<Db, Scope, readonly [RightAlias, RightCol]> extends SqlParserError<string>
			? SqlParserError<`Unknown column in JOIN (right side): ${RightAlias}.${RightCol}`>
			: ResolveColumnRefValue<Db, Scope, readonly [LeftAlias, LeftCol]> extends {
						sql: infer Ls extends SqlTypeShape
				  }
				? ResolveColumnRefValue<Db, Scope, readonly [RightAlias, RightCol]> extends {
						sql: infer Rs extends SqlTypeShape
					}
					? SameComparisonClass<Ls, Rs> extends true
						? true
						: SqlParserError<"Incompatible types in JOIN ON">
					: SqlParserError<`Unknown column in JOIN (right side): ${RightAlias}.${RightCol}`>
				: SqlParserError<`Unknown column in JOIN (left side): ${LeftAlias}.${LeftCol}`>

/** After `=` when the join predicate uses `alias.col = alias.col`. */
type ParseJoinEqPairAliasRightTail<
	R4 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	LeftAlias extends string,
	LeftCol extends string,
> =
	PeekToken<R4> extends TokenIdent<infer RightAlias extends string>
		? SkipToken<R4> extends infer R5 extends TokensList
			? PeekToken<R5> extends TokenKey<".">
				? SkipToken<R5> extends infer R6 extends TokensList
					? PeekToken<R6> extends TokenIdent<infer RightCol extends string>
						? SkipToken<R6> extends infer R7 extends TokensList
							? JoinOnAliasEqOk<Db, Scope, LeftAlias, LeftCol, RightAlias, RightCol> extends infer Ok
								? Ok extends true
									? [R7, true]
									: Ok extends SqlParserError<string>
										? [R7, Ok]
										: never
								: never
							: never
						: never
					: never
				: never
			: never
		: never

/** After `=` when the join predicate uses `schema.table.column = schema.table.column`. */
type ParseJoinEqPairQualifiedRightTail<
	R6 extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	LeftParts extends readonly [string, string, string],
> =
	PeekToken<R6> extends TokenIdent<infer S2 extends string>
		? SkipToken<R6> extends infer R7 extends TokensList
			? PeekToken<R7> extends TokenKey<".">
				? SkipToken<R7> extends infer R8 extends TokensList
					? PeekToken<R8> extends TokenIdent<infer T2 extends string>
						? SkipToken<R8> extends infer R9 extends TokensList
							? PeekToken<R9> extends TokenKey<".">
								? SkipToken<R9> extends infer R10 extends TokensList
									? PeekToken<R10> extends TokenIdent<infer C2 extends string>
										? SkipToken<R10> extends infer R11 extends TokensList
											? JoinOnQualifiedEqOk<
													Db,
													Scope,
													LeftParts,
													readonly [S2, T2, C2]
												> extends infer Ok
												? Ok extends true
													? [R11, true]
													: Ok extends SqlParserError<string>
														? [R11, Ok]
														: never
												: never
											: never
										: never
									: never
								: never
							: never
						: never
					: never
				: never
			: never
		: never

/** After the second identifier in the left column ref: qualified `… . … . …` vs `alias.col`. */
type ParseJoinEqPairAfterSecondIdent<
	R4 extends TokensList,
	TokAfterP2,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	P1 extends string,
	P2 extends string,
> =
	TokAfterP2 extends TokenKey<".">
		? PeekToken<R4> extends TokenIdent<infer P3 extends string>
			? SkipToken<R4> extends infer R5 extends TokensList
				? PeekToken<R5> extends TokenKey<"=">
					? SkipToken<R5> extends infer R6 extends TokensList
						? ParseJoinEqPairQualifiedRightTail<R6, Db, Scope, readonly [P1, P2, P3]>
						: never
					: never
				: never
			: never
		: TokAfterP2 extends TokenKey<"=">
			? ParseJoinEqPairAliasRightTail<R4, Db, Scope, P1, P2>
			: never

/** `ON` equality: `alias.col = alias.col` or `schema.table.column = schema.table.column`. */
type ParseJoinEqPair<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenIdent<infer P1 extends string>
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends TokensList
					? PeekToken<R2> extends TokenIdent<infer P2 extends string>
						? SkipToken<R2> extends infer R3 extends TokensList
							? PeekToken<R3> extends infer TokAfterP2
								? SkipToken<R3> extends infer R4 extends TokensList
									? ParseJoinEqPairAfterSecondIdent<R4, TokAfterP2, Db, Scope, P1, P2>
									: never
								: never
							: never
						: never
					: never
				: never
			: never
		: never

type ResolveSelectList<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = ResolveSelectListAcc<Items, Db, Scope, Params, {}, {}, Items>

type LookupSelectParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? Params[Name] extends SqlTypeShape
		? { sql: Params[Name] }
		: SqlParserError<"Invalid parameter type in SELECT">
	: SqlParserError<"Unknown query parameter in SELECT">

/** Bound parameter `:name` in the SELECT list — types come from `Params`. */
type ParamSelectOut<As, P extends string, Sql extends SqlTypeShape> = As extends string
	? { out: As; sql: Sql }
	: { out: P; sql: Sql }

type OutNameFromExprAst<Ast extends ScalarExprAst, As, AllItems extends readonly RawSelectItem[]> = As extends string
	? As
	: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
		? OutNameFromParts<P, undefined>
		: AllItems extends readonly [RawSelectItem]
			? "?column?"
			: "__invalid_select_expr_alias__"

/** First scope entry whose bound table matches `schema.table`. */
type ScopeEntryForQualifiedName<Scope extends ScopeMap, Sch extends string, Tab extends string> = {
	[K in keyof Scope]: Scope[K]["schema"] extends Sch ? (Scope[K]["table"] extends Tab ? Scope[K] : never) : never
}[keyof Scope]

type ResolveSelectListExprItem<
	Ast extends ScalarExprAst,
	As,
	R extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Cols extends Record<string, unknown>,
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[],
> = Ast extends { kind: "qualified_table_star"; schema: infer Sch extends string; table: infer Tab extends string }
	? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E
		? E extends ScopeEntry
			? ResolveSelectListAcc<
					R,
					Db,
					Scope,
					Params,
					MergeRecords<Cols, E["columns"]>,
					MergeStringRecords<Sqls, E["columns"]>,
					AllItems
				>
			: SqlParserError<"Unknown table in SELECT ... *">
		: SqlParserError<"Unknown table in SELECT ... *">
	: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
		? Al extends keyof Scope
			? Scope[Al] extends infer E extends ScopeEntry
				? ResolveSelectListAcc<
						R,
						Db,
						Scope,
						Params,
						MergeRecords<Cols, E["columns"]>,
						MergeStringRecords<Sqls, E["columns"]>,
						AllItems
					>
				: SqlParserError<"Unknown alias in SELECT ... *">
			: SqlParserError<"Unknown alias in SELECT ... *">
		: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Ev
			? Ev extends SqlParserError<string>
				? Ev
				: Ev extends SqlTypeShape
					? OutNameFromExprAst<Ast, As, AllItems> extends infer O extends string
						? O extends "__invalid_select_expr_alias__"
							? SqlParserError<"Scalar expression in SELECT requires AS alias">
							: ResolveSelectListAcc<
									R,
									Db,
									Scope,
									Params,
									MergeRecords<Cols, Record<O, unknown>>,
									MergeStringRecords<Sqls, Record<O, Ev>>,
									AllItems
								>
						: never
					: never
			: never

type ResolveSelectListParamItem<
	P extends string,
	As,
	R extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Cols extends Record<string, unknown>,
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[],
> =
	LookupSelectParam<Params, P> extends infer PV
		? PV extends SqlParserError<string>
			? PV
			: PV extends { sql: infer SqlP extends SqlTypeShape }
				? ParamSelectOut<As, P, SqlP> extends {
						out: infer O extends string
						sql: infer Sql extends SqlTypeShape
					}
					? ResolveSelectListAcc<
							R,
							Db,
							Scope,
							Params,
							MergeRecords<Cols, Record<O, unknown>>,
							MergeStringRecords<Sqls, Record<O, Sql>>,
							AllItems
						>
					: never
				: never
		: never

type ResolveSelectListAcc<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Cols extends Record<string, unknown>,
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[] = Items,
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "star" }
		? SingleAliasScope<Scope> extends true
			? ScopeEntryOfSingle<Scope> extends infer E extends ScopeEntry
				? ResolveSelectListAcc<
						R,
						Db,
						Scope,
						Params,
						MergeRecords<Cols, E["columns"]>,
						MergeStringRecords<Sqls, E["columns"]>,
						AllItems
					>
				: SqlParserError<"SELECT * requires a single FROM table">
			: SqlParserError<"SELECT * requires a single FROM table">
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst; as?: infer As }
			? ResolveSelectListExprItem<Ast, As, R, Db, Scope, Params, Cols, Sqls, AllItems>
			: H extends { kind: "param"; param: infer P extends string; as?: infer As }
				? ResolveSelectListParamItem<P, As, R, Db, Scope, Params, Cols, Sqls, AllItems>
				: never
	: { kind: "select"; columns: Sqls }

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : unknown
}

type MergeStringRecords<A extends Record<string, SqlTypeShape>, B extends Record<string, SqlTypeShape>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : SqlTypeShape
}

type SingleAliasScope<Scope extends ScopeMap> = keyof Scope extends infer K
	? K extends keyof Scope
		? Exclude<keyof Scope, K> extends never
			? true
			: false
		: false
	: false

type ScopeEntryOfSingle<Scope extends ScopeMap> = keyof Scope extends infer K
	? K extends keyof Scope
		? Scope[K]
		: never
	: never

type OutNameFromParts<
	P extends readonly [string] | readonly [string, string] | readonly [string, string, string],
	As,
> = As extends string
	? As
	: P extends readonly [string, string, infer C extends string]
		? C
		: P extends readonly [infer _A extends string, infer C2 extends string]
			? C2
			: P extends readonly [infer C0 extends string]
				? C0
				: "__bad_out_name_parts__"

/** Parse and resolve a `RETURNING` projection list against a caller-supplied `ScopeMap` (e.g. `INSERT` row). */
export type ParseAndResolveReturningClause<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseRawSelectList<Tokens, Db, Params, {}> extends [infer After extends TokensList, infer Items]
		? Items extends SqlParserError<string>
			? [After, Db, Items]
			: Items extends readonly RawSelectItem[]
				? SelectListStarInvalid<Items> extends true
					? [After, Db, SqlParserError<"SELECT * must be the only projection in the list">]
					: ResolveSelectList<Items, Db, Scope, Params> extends infer Res
						? Res extends SqlParserError<string>
							? [After, Db, Res]
							: Res extends JsqlSelectStatementResult
								? [After, Db, Res]
								: never
						: never
				: never
		: never
