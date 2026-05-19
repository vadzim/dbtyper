import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenParam } from "../lexer/sql-lexer.ts"
import type { TokenNumber } from "../lexer/sql-lexer.ts"
import type { TokenString } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
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
 * error types from other branches. Strip non-scope constituents before `extends ScopeMap`.
 */
type JoinScopeOnly<T> = Exclude<T, ParserRefErrorThirdSentinel | DbtyperErrorShape>

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
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<Tokens> extends TokenIdent<"with">
		? ParseSelectWithCtes<SkipToken<Tokens>, Db, Params, {}, OuterScope>
		: PeekToken<Tokens> extends TokenKey<"distinct">
			? ParseSelectAfterDistinct<SkipToken<Tokens>, Db, Params, {}, OuterScope>
			: ParseSelectAfterDistinct<Tokens, Db, Params, {}, OuterScope>

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

type ParseSelectWithCtesAfterSubquery<
	R4 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
	CteName extends string,
	SubOut extends JsqlSelectStatementResult,
	OuterScope extends ScopeMap = {},
> =
	SelectResultToDerivedScopeEntry<SubOut> extends infer Entry extends ScopeEntry
		? MergeScope<Record<CteName, Entry>, Acc> extends infer NextAcc
			? NextAcc extends ScopeMap
				? PeekToken<R4> extends TokenKey<",">
					? ParseSelectWithCtes<SkipToken<R4>, Db, Params, NextAcc, OuterScope>
					: PeekToken<R4> extends TokenKey<"select">
						? ParseSelectAfterDistinct<SkipToken<R4>, Db, Params, NextAcc, OuterScope>
						: SkipFailedStatement<R4, Db, FormatError<Errors["EXPECTED_SELECT_AFTER_WITH"], []>>
				: never
			: never
		: never

type ParseSelectWithCtes<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<Tokens> extends infer TokCteName
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokCteName extends TokenIdent<infer CteName extends string>
				? CteName extends keyof Acc
					? [R1, Db, FormatError<Errors["DUPLICATE_WITH_CLAUSE_NAME"], []>]
					: PeekToken<R1> extends TokenKey<"as">
						? SkipToken<R1> extends infer R2 extends ParserMonad
							? PeekToken<R2> extends TokenKey<"(">
								? SkipToken<R2> extends infer R3 extends ParserMonad
									? ParseParenEnclosedSelect<R3, Db, Params> extends [
											infer R4 extends ParserMonad,
											infer SubOut,
										]
										? SubOut extends DbtyperErrorShape
											? [R4, Db, SubOut]
											: SubOut extends JsqlSelectStatementResult
												? ParseSelectWithCtesAfterSubquery<
														R4,
														Db,
														Params,
														Acc,
														CteName,
														SubOut,
														OuterScope
													>
												: never
										: never
									: never
								: SkipFailedExpression<
											R2,
											FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_AS_IN_WITH"], []>
									  > extends [infer Rest extends ParserMonad, infer Err]
									? [Rest, Db, Err]
									: never
							: never
						: never
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_CTE_NAME_IN_WITH"], []>>
			: never
		: never

type ParseSelectAfterDistinct<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap = {},
	OuterScope extends ScopeMap = {},
> =
	MergeScope<CteBase, OuterScope> extends infer MergedOuterScope extends ScopeMap
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
															JoinScopeOnly<Tail>,
															OuterScope
														> extends infer MergedScope extends ScopeMap
														? ResolveSelectList<
																Items,
																Db,
																MergedScope,
																Params
															> extends infer Res
															? Res extends DbtyperErrorShape
																? [R, Db, Res]
																: FinishSelectStatement<
																		R,
																		Db,
																		Res,
																		MergedScope,
																		Params,
																		Items
																	>
															: never
														: never
													: never
											: never
									: never
								: never
							: PeekToken<AfterList> extends TokenKey<";"> | TokenKey<")"> | TokenEot
								? MergeScope<{}, OuterScope> extends infer MergedScope extends ScopeMap
									? ResolveSelectList<Items, Db, MergedScope, Params> extends infer Res
										? Res extends DbtyperErrorShape
											? [AfterList, Db, Res]
											: FinishSelectStatement<AfterList, Db, Res, MergedScope, Params, Items>
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

/** Scalar `ORDER BY` / `LIMIT` / `OFFSET` value: any resolved expression (unlike `WHERE`, not restricted to `boolean`). */
type ParseOrderByScalarExpr<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope; positionalParamIndex: 0 }> extends [
		infer Rw extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<Rw, Ast>
			: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
				? R extends DbtyperErrorShape
					? SkipFailedExpression<Rw, R>
					: R extends SqlTypeShape
						? [Rw, null]
						: SkipFailedExpression<Rw, never>
				: never
		: never

type ParseOrderByOneTerm<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseOrderByScalarExpr<Tokens, Db, Scope, Params> extends [infer R1 extends ParserMonad, infer E1]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpression<R1, E1>
			: PeekToken<R1> extends TokenKey<"asc">
				? [SkipToken<R1>, null]
				: PeekToken<R1> extends TokenKey<"desc">
					? [SkipToken<R1>, null]
					: [R1, null]
		: never

type ParseOrderByTerms<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseOrderByOneTerm<Tokens, Db, Scope, Params> extends [infer R1 extends ParserMonad, infer E1]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpression<R1, E1>
			: PeekToken<R1> extends TokenKey<",">
				? ParseOrderByTerms<SkipToken<R1>, Db, Scope, Params>
				: [R1, null]
		: never

type ParseOrderByAfterOrderKw<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends infer TBy
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? TBy extends TokenKey<"by">
				? ParseOrderByTerms<R2, Db, Scope, Params>
				: SkipFailedExpression<R2, FormatError<Errors["EXPECTED_BY_AFTER_ORDER"], []>>
			: never
		: never

type ParseOptionalOrderByTokens<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"order">
		? ParseOrderByAfterOrderKw<SkipToken<Tokens>, Db, Scope, Params>
		: [Tokens, null]

type LimitExprThenOptionalOffset<
	Rl1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Rl1> extends TokenKey<"offset">
		? SkipToken<Rl1> extends infer Ro0 extends ParserMonad
			? ParseOrderByScalarExpr<Ro0, Db, Scope, Params> extends [infer Ro1 extends ParserMonad, infer Oe]
				? Oe extends DbtyperErrorShape
					? SkipFailedExpression<Ro1, Oe>
					: [Ro1, null]
				: never
			: never
		: [Rl1, null]

/** After `OFFSET` expr: optional `LIMIT` expr (PostgreSQL allows `OFFSET … LIMIT …`). */
type OffsetExprThenOptionalLimit<
	Ro1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Ro1> extends TokenKey<"limit">
		? SkipToken<Ro1> extends infer Rl0 extends ParserMonad
			? ParseOrderByScalarExpr<Rl0, Db, Scope, Params> extends [infer Rl1 extends ParserMonad, infer Le]
				? Le extends DbtyperErrorShape
					? SkipFailedExpression<Rl1, Le>
					: [Rl1, null]
				: never
			: never
		: [Ro1, null]

type ExpectRowOrRowsThenOnly<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"rows">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"only">
				? [SkipToken<R1>, null]
				: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_ONLY_AFTER_FETCH_ROWS"], []>>
			: never
		: PeekToken<Tokens> extends TokenKey<"row">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"only">
					? [SkipToken<R1>, null]
					: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_ONLY_AFTER_FETCH_ROW"], []>>
				: never
			: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_ROW_OR_ROWS_IN_FETCH"], []>>

type ParseFetchFirstAfterFetchKw<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends TokenKey<"first">
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? ParseOrderByScalarExpr<R2, Db, Scope, Params> extends [infer R3 extends ParserMonad, infer E]
				? E extends DbtyperErrorShape
					? SkipFailedExpression<R3, E>
					: ExpectRowOrRowsThenOnly<R3>
				: never
			: never
		: PeekToken<R1> extends TokenKey<"next">
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? ParseOrderByScalarExpr<R2, Db, Scope, Params> extends [infer R3 extends ParserMonad, infer E]
					? E extends DbtyperErrorShape
						? SkipFailedExpression<R3, E>
						: ExpectRowOrRowsThenOnly<R3>
					: never
				: never
			: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_FIRST_OR_NEXT_AFTER_FETCH"], []>>

/** Optional `LIMIT …` / `OFFSET …` / `FETCH FIRST|NEXT … ROW(S) ONLY` (single paging block). */
type ParseOptionalPagingTokens<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"limit">
		? SkipToken<Tokens> extends infer Rl0 extends ParserMonad
			? ParseOrderByScalarExpr<Rl0, Db, Scope, Params> extends [infer Rl1 extends ParserMonad, infer Le]
				? Le extends DbtyperErrorShape
					? SkipFailedExpression<Rl1, Le>
					: LimitExprThenOptionalOffset<Rl1, Db, Scope, Params>
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"offset">
			? SkipToken<Tokens> extends infer Ro0 extends ParserMonad
				? ParseOrderByScalarExpr<Ro0, Db, Scope, Params> extends [infer Ro1 extends ParserMonad, infer Oe]
					? Oe extends DbtyperErrorShape
						? SkipFailedExpression<Ro1, Oe>
						: OffsetExprThenOptionalLimit<Ro1, Db, Scope, Params>
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"fetch">
				? ParseFetchFirstAfterFetchKw<SkipToken<Tokens>, Db, Scope, Params>
				: [Tokens, null]

type SelectGroupClauseMeta = {
	readonly have_explicit_group_by: boolean
	readonly has_having_clause: boolean
	readonly group_key_asts: readonly ScalarExprAst[]
}

type GroupByAstResolution<
	R1 extends ParserMonad,
	Ast extends ScalarExprAst,
	Acc extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Rv
		? Rv extends DbtyperErrorShape
			? readonly [R1, { readonly error: Rv }]
			: Rv extends SqlTypeShape
				? PeekToken<R1> extends TokenKey<",">
					? ParseGroupByTermsAcc<SkipToken<R1>, Db, Scope, Params, readonly [...Acc, Ast]>
					: readonly [R1, { readonly keys: readonly [...Acc, Ast] }]
				: readonly [R1, { readonly error: never }]
		: never

type ParseGroupByTermsAcc<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope; positionalParamIndex: 0 }> extends [
		infer R1 extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? readonly [R1, { readonly error: Ast }]
			: Ast extends ScalarExprAst
				? GroupByAstResolution<R1, Ast, Acc, Db, Scope, Params>
				: readonly [R1, { readonly error: never }]
		: never

/** After `GROUP BY expr[, …]`; optionally parse `HAVING`. */
type ParseOptionalHavingClauseAfterGroupTerms<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Gbs extends readonly ScalarExprAst[],
> =
	PeekToken<R2> extends TokenKey<"having">
		? SkipToken<R2> extends infer Rh extends ParserMonad
			? ParseWhereExpression<Rh, Db, Scope, Params> extends [infer Rhw extends ParserMonad, infer He]
				? He extends DbtyperErrorShape
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
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"having">
		? SkipToken<Tokens> extends infer Rh extends ParserMonad
			? ParseWhereExpression<Rh, Db, Scope, Params> extends [infer Rhw extends ParserMonad, infer He]
				? He extends DbtyperErrorShape
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
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Outcome,
> = Outcome extends { readonly error: infer Ge extends DbtyperErrorShape }
	? readonly [R2, Ge, EmptyGroupClauseMetaPlain]
	: Outcome extends { readonly keys: infer Gbs extends readonly ScalarExprAst[] }
		? ParseOptionalHavingClauseAfterGroupTerms<R2, Db, Scope, Params, Gbs> extends readonly [
				infer R3 extends ParserMonad,
				infer He,
				infer Meta extends SelectGroupClauseMeta,
			]
			? readonly [R3, He, Meta]
			: never
		: never

type ParseOptionalGroupHaving<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"group">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"by">
				? SkipToken<R0> extends infer R1 extends ParserMonad
					? ParseGroupByTermsAcc<R1, Db, Scope, Params> extends readonly [
							infer R2 extends ParserMonad,
							infer Outcome,
						]
						? ParseGroupTailAfterTerms<R2, Db, Scope, Params, Outcome>
						: never
					: never
				: readonly [R0, FormatError<Errors["EXPECTED_BY_AFTER_GROUP"], []>, EmptyGroupClauseMetaPlain]
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
			: FormatError<Errors["GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE"], []>
		: H extends { kind: "star" } | { kind: "param" }
			? ValidateGroupedSelectItemsAgainstKeys<Rest, GroupKeys>
			: never
	: true

type GroupedProjValidationOutcome<Items extends readonly RawSelectItem[], Meta extends SelectGroupClauseMeta> =
	SelectItemsNeedGroupedProjRules<Meta, Items> extends true
		? ValidateGroupedSelectItemsAgainstKeys<Items, Meta["group_key_asts"]>
		: true

type SelectAfterWhereAndGroupHaving<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Res,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Items extends readonly RawSelectItem[],
> =
	ParseOptionalGroupHaving<Tokens, Db, Scope, Params> extends readonly [
		infer T1 extends ParserMonad,
		infer Gh,
		infer Meta extends SelectGroupClauseMeta,
	]
		? Gh extends DbtyperErrorShape
			? [T1, Db, Gh]
			: GroupedProjValidationOutcome<Items, Meta> extends infer V
				? V extends DbtyperErrorShape
					? [T1, Db, V]
					: ParseSelectTrailingClauses<T1, Db, Scope, Params> extends [infer Rt extends ParserMonad, infer Te]
						? Te extends DbtyperErrorShape
							? [Rt, Db, Te]
							: [Rt, Db, Res]
						: never
				: never
		: never

/** Optional `ORDER BY …` then optional paging; does not change projection type (`Res`). */
type ParseSelectTrailingClauses<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseOptionalOrderByTokens<Tokens, Db, Scope, Params> extends [infer T1 extends ParserMonad, infer E1]
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
> =
	PeekToken<Tokens> extends TokenKey<"where">
		? SkipToken<Tokens> extends infer Rw0 extends ParserMonad
			? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends ParserMonad, infer We]
				? We extends DbtyperErrorShape
					? [Rw, Db, We]
					: SelectAfterWhereAndGroupHaving<Rw, Db, Res, Scope, Params, Items>
				: never
			: never
		: SelectAfterWhereAndGroupHaving<Tokens, Db, Res, Scope, Params, Items>

type ParseRawSelectList<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
	Acc extends readonly RawSelectItem[] = [],
	PositionalParamIndex extends number = 0,
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? [Tokens, Acc]
		: PeekToken<Tokens> extends TokenKey<"*">
			? ParseRawSelectListAfterItem<
					SkipToken<Tokens>,
					Db,
					Params,
					OuterScope,
					[...Acc, { kind: "star" }],
					PositionalParamIndex
				>
			: ParseOneRawSelectItem<Tokens, Db, Params, OuterScope, PositionalParamIndex> extends [
						infer AfterItem extends ParserMonad,
						infer It,
						infer NextIndex extends number,
				  ]
				? It extends DbtyperErrorShape
					? SkipFailedExpression<AfterItem, It>
					: It extends RawSelectItem
						? ParseRawSelectListAfterItem<AfterItem, Db, Params, OuterScope, [...Acc, It], NextIndex>
						: never
				: never

type ParseRawSelectListAfterItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	Acc extends readonly RawSelectItem[],
	PositionalParamIndex extends number,
> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseRawSelectList<SkipToken<Tokens>, Db, Params, OuterScope, Acc, PositionalParamIndex>
		: [Tokens, Acc]

type ParseOneRawSelectExprItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	PositionalParamIndex extends number,
> =
	ParseExpressionAST<
		Tokens,
		{ db: Db; params: Params; outerScope: OuterScope; positionalParamIndex: PositionalParamIndex }
	> extends [
		infer RExpr extends ParserMonad,
		infer Out,
		infer UpdatedEnv extends import("./parse-expression.ts").ExprParseEnv,
	]
		? Out extends DbtyperErrorShape
			? [RExpr, Out, PositionalParamIndex]
			: Out extends ScalarExprAst
				? ParseOptionalAs<RExpr> extends [infer M2 extends ParserMonad, infer As extends string | undefined]
					? As extends string
						? [M2, { kind: "expr"; ast: Out; as: As }, UpdatedEnv["positionalParamIndex"]]
						: Out extends { kind: "col"; parts: ScalarIdentParts }
							? [M2, { kind: "expr"; ast: Out }, UpdatedEnv["positionalParamIndex"]]
							: [M2, { kind: "expr"; ast: Out }, UpdatedEnv["positionalParamIndex"]]
					: never
				: never
		: never

type ParseOneRawSelectItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	PositionalParamIndex extends number,
> =
	PeekToken<Tokens> extends TokenParam<infer P extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? ParseOptionalAs<R1> extends [infer M2 extends ParserMonad, infer As extends string | undefined]
				? [M2, RawSelectParamItem<P, As>, PositionalParamIndex]
				: never
			: never
		: PeekToken<Tokens> extends TokenIdent<string>
			? ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope, PositionalParamIndex>
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
						| TokenKey<"?">
					? ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope, PositionalParamIndex>
					: never
				: never

type ParseOptionalAs<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"as">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenIdent<infer N extends string>
				? [SkipToken<R1>, N]
				: [R1, undefined]
			: never
		: [Tokens, undefined]

/** Row shape of a parsed inner `SELECT` used as a derived table in `FROM` / `JOIN`. */
type SelectResultToDerivedScopeEntry<Res extends JsqlSelectStatementResult> = {
	schema: "__subquery__"
	table: "__subquery__"
	columns: Res["returning"]
}

/** Helper: Consume closing `)` after subquery. Returns [Tokens, Result] or error. */
type ConsumeClosingParen<Tokens extends ParserMonad, Result> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Result]
		: Result extends JsqlSelectStatementResult
			? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY"], []>>
			: [Tokens, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY"], []>]

/** Helper: Validate that a SELECT result has exactly one column (for scalar subqueries). */
type ValidateSingleColumn<Result extends JsqlSelectStatementResult> = Result["returning"] extends infer Cols
	? [keyof Cols] extends [infer K]
		? K extends string
			? Result
			: FormatError<Errors["SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>
		: FormatError<Errors["SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>
	: never

/** Helper: Parse alias after derived table and merge into scope. Returns [Tokens, null, Scope] or error. */
type ParseAliasAfterDerived<
	Tokens extends ParserMonad,
	_Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Result extends JsqlSelectStatementResult,
> =
	SelectResultToDerivedScopeEntry<Result> extends infer Entry extends ScopeEntry
		? PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras extends ParserMonad
				? PeekToken<Ras> extends TokenIdent<infer Alias extends string>
					? [SkipToken<Ras>, null, MergeScope<Record<Alias, Entry>, OuterScope>]
					: [
							SkipToken<Ras>,
							FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>,
							ParserRefErrorThirdSentinel,
						]
				: never
			: PeekToken<Tokens> extends TokenIdent<infer Alias extends string>
				? [SkipToken<Tokens>, null, MergeScope<Record<Alias, Entry>, OuterScope>]
				: [Tokens, FormatError<Errors["EXPECTED_ALIAS_AFTER_DERIVED_TABLE"], []>, ParserRefErrorThirdSentinel]
		: never

/** Inner `( SELECT … FROM … [WHERE …] )` ending with `)`; multi-column allowed (`EXISTS`, CTE, `IN (SELECT …)`). */
export type ParseParenEnclosedSelect<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, OuterScope> extends [
				infer R2 extends ParserMonad,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends DbtyperErrorShape
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result>
					: never
			: never
		: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>

/** Scalar subquery: exactly one non-`*` projection. */
export type ParseParenScalarSelect<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, OuterScope> extends [
				infer R2 extends ParserMonad,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends DbtyperErrorShape
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ValidateSingleColumn<Result> extends infer Validated
						? Validated extends DbtyperErrorShape
							? SkipFailedExpression<R2, Validated>
							: ConsumeClosingParen<R2, Validated>
						: never
					: never
			: never
		: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>

type ParseParenDerivedSelect<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, {}> extends [
				infer R2 extends ParserMonad,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends DbtyperErrorShape
				? [R2, Result, ParserRefErrorThirdSentinel]
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result> extends [infer R3 extends ParserMonad, infer Validated]
						? Validated extends DbtyperErrorShape
							? [R3, Validated, ParserRefErrorThirdSentinel]
							: Validated extends JsqlSelectStatementResult
								? ParseAliasAfterDerived<R3, Db, OuterScope, Validated>
								: never
						: never
					: never
			: never
		: [R1, FormatError<Errors["EXPECTED_SELECT_IN_DERIVED_TABLE"], []>, ParserRefErrorThirdSentinel]

type ParseFromTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Tok extends TokenKey<"(">
				? ParseParenDerivedSelect<R1, Db, Scope, Params>
				: Tok extends TokenIdent<infer A extends string>
					? ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
					: [
							R1,
							FormatError<Errors["EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM"], []>,
							ParserRefErrorThirdSentinel,
						]
			: never
		: never

type ParseFromJoinScope<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseFromTableRef<Tokens, Db, Scope, Params> extends [infer R0 extends ParserMonad, infer Mid, infer Third]
		? Mid extends DbtyperErrorShape
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
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	A extends string,
	Scope extends ScopeMap,
> =
	PeekToken<R1> extends TokenKey<".">
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? PeekToken<R2> extends infer TokB
				? SkipToken<R2> extends infer R3 extends ParserMonad
					? TokB extends TokenIdent<infer B extends string>
						? JsqlDbGetData<Db, A, B> extends infer Tbl extends JsqlDataShape
							? ParseAliasAfterTable<R3, A, B, Tbl, Scope>
							: [
									R3,
									FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [A, "FROM"]>,
									ParserRefErrorThirdSentinel,
								]
						: [
								R3,
								FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in FROM"]>,
								ParserRefErrorThirdSentinel,
							]
					: never
				: never
			: never
		: A extends keyof Scope
			? ParseAliasAfterCTE<R1, A, Scope[A], Scope>
			: JsqlDbGetData<Db, Db["defaultSchema"], A> extends infer Tbl extends JsqlDataShape
				? ParseAliasAfterTable<R1, Db["defaultSchema"], A, Tbl, Scope>
				: [R1, FormatError<Errors["UNKNOWN_TABLE"], [A, "FROM"]>, ParserRefErrorThirdSentinel]

type ParseAliasAfterCTE<
	Tokens extends ParserMonad,
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
			? SkipToken<Tokens> extends infer Ras0 extends ParserMonad
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends ParserMonad
						? TokName extends TokenIdent<infer Alias extends string>
							? [Ra, null, MergeScope<Record<Alias, CteEntry>, Scope>]
							: [Ra, FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>, ParserRefErrorThirdSentinel]
						: never
					: never
				: never
			: PeekToken<Tokens> extends infer TokAlias
				? SkipToken<Tokens> extends infer Ra extends ParserMonad
					? TokAlias extends TokenIdent<infer Alias extends string>
						? [Ra, null, MergeScope<Record<Alias, CteEntry>, Scope>]
						: [Ra, FormatError<Errors["EXPECTED_ALIAS_AFTER_CTE"], []>, ParserRefErrorThirdSentinel]
					: never
				: never

type ParseAliasAfterTable<
	Tokens extends ParserMonad,
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
			? SkipToken<Tokens> extends infer Ras0 extends ParserMonad
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends ParserMonad
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
							: [Ra, FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>, ParserRefErrorThirdSentinel]
						: never
					: never
				: never
			: PeekToken<Tokens> extends infer TokAlias
				? SkipToken<Tokens> extends infer Ra extends ParserMonad
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
						: [
								Ra,
								FormatError<Errors["EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE"], []>,
								ParserRefErrorThirdSentinel,
							]
					: never
				: never

type ParseJoinChain<
	Tokens extends ParserMonad,
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
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? SkipToken<Tokens> extends infer AfterJ extends ParserMonad
			? ParseFromTableRef<AfterJ, Db, Scope, Params> extends [
					infer R0 extends ParserMonad,
					infer Mid,
					infer Third,
				]
				? Mid extends DbtyperErrorShape
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
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["CROSS"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterOptionalInner<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["INNER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterLeft<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterOptionalOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["LEFT"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterRight<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterRightOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["RIGHT"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterRightOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["RIGHT OUTER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterFull<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterFullOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["FULL"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterFullOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["FULL OUTER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterOptionalOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params>
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["LEFT OUTER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterJoinKw<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? SkipToken<Tokens> extends infer AfterJ extends ParserMonad
			? ParseFromTableRef<AfterJ, Db, Scope, Params> extends [
					infer R0 extends ParserMonad,
					infer Mid,
					infer Third,
				]
				? Mid extends DbtyperErrorShape
					? Third extends ParserRefErrorThirdSentinel
						? [R0, Mid, ParserRefErrorThirdSentinel]
						: never
					: Mid extends null
						? [JoinScopeOnly<Third>] extends [never]
							? never
							: JoinScopeOnly<Third> extends ScopeMap
								? PeekToken<R0> extends TokenKeyOn
									? ParseJoinOn<R0, Db, JoinScopeOnly<Third>, Params>
									: [
											R0,
											FormatError<Errors["EXPECTED_ON_AFTER_JOIN_TABLE"], []>,
											ParserRefErrorThirdSentinel,
										]
								: [
										R0,
										FormatError<Errors["EXPECTED_ON_AFTER_JOIN_TABLE"], []>,
										ParserRefErrorThirdSentinel,
									]
						: never
				: never
			: never
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], [""]>, ParserRefErrorThirdSentinel]

type ParseJoinOn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends infer TokOn
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokOn extends TokenKeyOn
				? ParseJoinEqPair<R1, Db, Scope> extends [infer R2 extends ParserMonad, infer Tag]
					? Tag extends DbtyperErrorShape
						? [R2, Tag, ParserRefErrorThirdSentinel]
						: Tag extends true
							? ParseJoinChain<R2, Db, Scope, Params>
							: never
					: never
				: [R1, FormatError<Errors["EXPECTED_ON_KEYWORD"], []>, ParserRefErrorThirdSentinel]
			: never
		: never

/** Both sides of `ON` are `schema.table.column`; validate against catalog. */
type JoinOnQualifiedEqOk<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	L extends readonly [string, string, string],
	R extends readonly [string, string, string],
> =
	ResolveColumnRefValue<Db, Scope, L> extends DbtyperErrorShape
		? FormatError<Errors["UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN"], [L[0], L[1], L[2]]>
		: ResolveColumnRefValue<Db, Scope, R> extends DbtyperErrorShape
			? FormatError<Errors["UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN"], [R[0], R[1], R[2]]>
			: ResolveColumnRefValue<Db, Scope, L> extends { sql: infer Ls extends SqlTypeShape }
				? ResolveColumnRefValue<Db, Scope, R> extends { sql: infer Rs extends SqlTypeShape }
					? SameComparisonClass<Ls, Rs> extends true
						? true
						: FormatError<Errors["INCOMPATIBLE_TYPES_IN_JOIN_ON"], []>
					: FormatError<Errors["UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN"], [R[0], R[1], R[2]]>
				: FormatError<Errors["UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN"], [L[0], L[1], L[2]]>

type JoinOnAliasEqOk<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	LeftAlias extends string,
	LeftCol extends string,
	RightAlias extends string,
	RightCol extends string,
> =
	ResolveColumnRefValue<Db, Scope, readonly [LeftAlias, LeftCol]> extends infer LeftRefValue
		? LeftRefValue extends DbtyperErrorShape
			? FormatError<Errors["UNKNOWN_QUALIFIED_COLUMN"], [LeftAlias, LeftCol]>
			: ResolveColumnRefValue<Db, Scope, readonly [RightAlias, RightCol]> extends infer RightLeftValue
				? RightLeftValue extends DbtyperErrorShape
					? FormatError<Errors["UNKNOWN_QUALIFIED_COLUMN"], [RightAlias, RightCol]>
					: LeftRefValue extends { sql: infer Ls extends SqlTypeShape }
						? RightLeftValue extends { sql: infer Rs extends SqlTypeShape }
							? SameComparisonClass<Ls, Rs> extends true
								? true
								: FormatError<Errors["INCOMPATIBLE_TYPES_IN_JOIN_ON"], []>
							: FormatError<Errors["UNKNOWN_QUALIFIED_COLUMN"], [RightAlias, RightCol]>
						: FormatError<Errors["UNKNOWN_QUALIFIED_COLUMN"], [LeftAlias, LeftCol]>
				: never
		: never

/** After `=` when the join predicate uses `alias.col = alias.col`. */
type ParseJoinEqPairAliasRightTail<
	R4 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	LeftAlias extends string,
	LeftCol extends string,
> =
	PeekToken<R4> extends TokenIdent<infer RightAlias extends string>
		? SkipToken<R4> extends infer R5 extends ParserMonad
			? PeekToken<R5> extends TokenKey<".">
				? SkipToken<R5> extends infer R6 extends ParserMonad
					? PeekToken<R6> extends TokenIdent<infer RightCol extends string>
						? SkipToken<R6> extends infer R7 extends ParserMonad
							? JoinOnAliasEqOk<Db, Scope, LeftAlias, LeftCol, RightAlias, RightCol> extends infer Ok
								? Ok extends true
									? [R7, true]
									: Ok extends DbtyperErrorShape
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
	R6 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	LeftParts extends readonly [string, string, string],
> =
	PeekToken<R6> extends TokenIdent<infer S2 extends string>
		? SkipToken<R6> extends infer R7 extends ParserMonad
			? PeekToken<R7> extends TokenKey<".">
				? SkipToken<R7> extends infer R8 extends ParserMonad
					? PeekToken<R8> extends TokenIdent<infer T2 extends string>
						? SkipToken<R8> extends infer R9 extends ParserMonad
							? PeekToken<R9> extends TokenKey<".">
								? SkipToken<R9> extends infer R10 extends ParserMonad
									? PeekToken<R10> extends TokenIdent<infer C2 extends string>
										? SkipToken<R10> extends infer R11 extends ParserMonad
											? JoinOnQualifiedEqOk<
													Db,
													Scope,
													LeftParts,
													readonly [S2, T2, C2]
												> extends infer Ok
												? Ok extends true
													? [R11, true]
													: Ok extends DbtyperErrorShape
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
	R4 extends ParserMonad,
	TokAfterP2,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	P1 extends string,
	P2 extends string,
> =
	TokAfterP2 extends TokenKey<".">
		? PeekToken<R4> extends TokenIdent<infer P3 extends string>
			? SkipToken<R4> extends infer R5 extends ParserMonad
				? PeekToken<R5> extends TokenKey<"=">
					? ParseJoinEqPairQualifiedRightTail<SkipToken<R5>, Db, Scope, readonly [P1, P2, P3]>
					: never
				: never
			: never
		: TokAfterP2 extends TokenKey<"=">
			? ParseJoinEqPairAliasRightTail<R4, Db, Scope, P1, P2>
			: never

/** `ON` equality: `alias.col = alias.col` or `schema.table.column = schema.table.column`. */
type ParseJoinEqPair<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenIdent<infer P1 extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? PeekToken<R2> extends TokenIdent<infer P2 extends string>
						? SkipToken<R2> extends infer R3 extends ParserMonad
							? PeekToken<R3> extends infer TokAfterP2
								? ParseJoinEqPairAfterSecondIdent<SkipToken<R3>, TokAfterP2, Db, Scope, P1, P2>
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
> = ResolveSelectListAcc<Items, Db, Scope, Params, {}, Items>

type LookupSelectParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? Params[Name] extends SqlTypeShape
		? { sql: Params[Name] }
		: never
	: FormatError<Errors["UNKNOWN_QUERY_PARAMETER"], [Name]>

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
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[],
> = Ast extends { kind: "qualified_table_star"; schema: infer Sch extends string; table: infer Tab extends string }
	? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E
		? E extends ScopeEntry
			? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, E["columns"]>, AllItems>
			: FormatError<Errors["UNKNOWN_TABLE"], [Sch, "SELECT ... *"]>
		: FormatError<Errors["UNKNOWN_TABLE"], [Tab, "SELECT ... *"]>
	: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
		? Al extends keyof Scope
			? Scope[Al] extends infer E extends ScopeEntry
				? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, E["columns"]>, AllItems>
				: FormatError<Errors["UNKNOWN_ALIAS_IN_SELECT_STAR"], []>
			: FormatError<Errors["UNKNOWN_ALIAS_IN_SELECT_STAR"], []>
		: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? OutNameFromExprAst<Ast, As, AllItems> extends infer O extends string
						? O extends "__invalid_select_expr_alias__"
							? FormatError<Errors["SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS"], []>
							: ResolveSelectListAcc<
									R,
									Db,
									Scope,
									Params,
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
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[],
> =
	LookupSelectParam<Params, P> extends infer PV
		? PV extends DbtyperErrorShape
			? PV
			: PV extends { sql: infer SqlP extends SqlTypeShape }
				? ParamSelectOut<As, P, SqlP> extends {
						out: infer O extends string
						sql: infer Sql extends SqlTypeShape
					}
					? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, Record<O, Sql>>, AllItems>
					: never
				: never
		: never

type ResolveSelectListAcc<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[] = Items,
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "star" }
		? SingleAliasScope<Scope> extends true
			? ScopeEntryOfSingle<Scope> extends infer E extends ScopeEntry
				? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, E["columns"]>, AllItems>
				: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst; as?: infer As }
			? ResolveSelectListExprItem<Ast, As, R, Db, Scope, Params, Sqls, AllItems>
			: H extends { kind: "param"; param: infer P extends string; as?: infer As }
				? ResolveSelectListParamItem<P, As, R, Db, Scope, Params, Sqls, AllItems>
				: never
	: { kind: "select"; returning: Sqls }

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
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseRawSelectList<Tokens, Db, Params, {}> extends [infer After extends ParserMonad, infer Items]
		? Items extends DbtyperErrorShape
			? [After, Db, Items]
			: Items extends readonly RawSelectItem[]
				? SelectListStarInvalid<Items> extends true
					? [After, Db, FormatError<Errors["SELECT_STAR_MUST_BE_THE_ONLY_PROJECTION_IN_THE_LIST"], []>]
					: ResolveSelectList<Items, Db, Scope, Params> extends infer Res
						? Res extends DbtyperErrorShape
							? [After, Db, Res]
							: Res extends JsqlSelectStatementResult
								? [After, Db, Res]
								: never
						: never
				: never
		: never
