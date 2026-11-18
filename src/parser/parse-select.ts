import type { IsAggregateCall } from "./function-catalog.ts"
import type { ForceProps, MergeRecords } from "../core/type-utils.ts"
import type { ParamProbeFound, ProbeKeyOf } from "../core/param-probe.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, SourceSpan, TokenEotWithDialectError } from "../lexer/parser-monad.ts"
import type { TokenEot, TokenIndexedParam } from "../lexer/sql-lexer.ts"
import type { TokenParam } from "../lexer/sql-lexer.ts"
import type { TokenNumber } from "../lexer/sql-lexer.ts"
import type { TokenString } from "../lexer/sql-lexer.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ParseCallArgs,
	ParseExpressionAST,
	ResolveExpressionAST,
	ScalarExprAst,
	ScalarIdentParts,
} from "./parse-expression.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type {
	FromItemsOnly,
	MarkOuterScope,
	MergeScope,
	ScopeEntry,
	ScopeMap,
	VisibleColumnsOf,
	TableScopeColumns,
	HiddenColumnsOf,
} from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { JsqlDbGetData, UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { DbDialectOnlyError, DialectFact, DialectOf } from "../core/dialect.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlInteger, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { ParseInsert } from "./parse-insert.ts"
import type { ParseUpdate } from "./parse-update.ts"
import type { ParseDelete } from "./parse-delete.ts"
import type {
	FirstDuplicateName,
	MergeSetOperation,
	RenameOutputColumns,
	UnionToStringTuple,
} from "./set-operation-types.ts"

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
	| { kind: "expr"; ast: ScalarExprAst; as?: string; key?: string }

/** SQLT-28: an item's output name before the AST rules: the alias, else the source text kept for dialects with `exprKeys: "text"`. */
type ItemAs<H> = H extends { as: infer A extends string }
	? A
	: H extends { key: infer K extends string }
		? K
		: undefined

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
type ParseSelectCompound<
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
type ParseSelectArm<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
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
								? ParseSelectAfterDistinct<R1, Db, Params, CteBase, OuterScope, OnAsts>
								: never
						: never
				: ParseSelectAfterDistinct<R0, Db, Params, CteBase, OuterScope>
			: never
		: ParseSelectAfterDistinct<Tokens, Db, Params, CteBase, OuterScope>

/**
 * PGT-23: `DISTINCT ON (expr, …)` after the keyword `ON`. The expressions are parsed here and resolved against the
 * FROM scope by {@link DistinctOnError} (the list comes before FROM). Returns `[Tokens, asts | error]`.
 */
type ParseDistinctOnList<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseDistinctOnItems<SkipToken<Tokens>, Db, Params, OuterScope, readonly []>
		: SkipFailedExpression<Tokens, FormatError<Errors["UNEXPECTED_TOKEN"], ["ON"]>>

type ParseDistinctOnItems<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	Acc extends readonly ScalarExprAst[],
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: OuterScope }> extends [
		infer R1 extends ParserMonad,
		infer Ast,
		infer _Env,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<R1, Ast>
			: Ast extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<",">
					? ParseDistinctOnItems<SkipToken<R1>, Db, Params, OuterScope, readonly [...Acc, Ast]>
					: PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, Ast]]
						: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>>
				: never
		: never

/** The first error of the `DISTINCT ON` expressions resolved against the FROM scope, or `null`. */
type DistinctOnError<
	OnAsts extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = OnAsts extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer R
		? R extends DbtyperErrorShape
			? WithErrorClause<R, "DISTINCT ON">
			: DistinctOnError<T, Db, Scope, Params>
		: never
	: null

type SetOperationKeyword<T> =
	T extends TokenKey<"union">
		? "UNION"
		: T extends TokenKey<"intersect">
			? "INTERSECT"
			: T extends TokenKey<"except">
				? "EXCEPT"
				: never

type ParseSetOperationTail<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Left extends JsqlSelectStatementResult,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
> = [SetOperationKeyword<PeekToken<Tokens>>] extends [never]
	? [Tokens, Db, Left]
	: ParseSetOperationRightArm<SkipToken<Tokens>, Db, Params, CteBase, OuterScope> extends [
				infer R extends ParserMonad,
				infer Right,
		  ]
		? Right extends DbtyperErrorShape
			? [R, Db, Right]
			: Right extends JsqlSelectStatementResult
				? MergeSetOperation<Left, Right, SetOperationKeyword<PeekToken<Tokens>>> extends infer Merged
					? Merged extends JsqlSelectStatementResult
						? ParseSetOperationTail<R, Db, Merged, Params, CteBase, OuterScope>
						: [R, Db, Merged]
					: never
				: never
		: never

/** After the set operator keyword: optional `ALL` / `DISTINCT`, then `SELECT …`. Returns `[Tokens, Result | error]`. */
type ParseSetOperationRightArm<
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

type ParseSetOperationSelect<
	R0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteBase extends ScopeMap,
	OuterScope extends ScopeMap,
> =
	PeekToken<R0> extends TokenKey<"select">
		? SkipToken<R0> extends infer R1 extends ParserMonad
			? ParseSelectArm<R1, Db, Params, CteBase, OuterScope> extends [
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

type ParseSelectWithCtesAfterSubquery<
	R4 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
	CteName extends string,
	SubOut extends JsqlSelectStatementResult,
	OuterScope extends ScopeMap,
	CteBase extends ScopeMap,
	Recursive extends boolean,
> =
	SelectResultToCteScopeEntry<SubOut> extends infer Entry extends ScopeEntry
		? MergeScope<Record<CteName, Entry>, Acc> extends infer NextAcc
			? NextAcc extends ScopeMap
				? PeekToken<R4> extends TokenKey<",">
					? ParseSelectWithCtes<SkipToken<R4>, Db, Params, NextAcc, OuterScope, CteBase, Recursive>
					: PeekToken<R4> extends TokenKey<"select">
						? ParseSelectCompound<SkipToken<R4>, Db, Params, MergeScope<NextAcc, CteBase>, OuterScope>
						: SkipFailedStatement<R4, Db, FormatError<Errors["EXPECTED_SELECT_AFTER_WITH"], []>>
				: never
			: never
		: never

/** Optional `(col, …)` after a CTE name. Returns `[Tokens, names | error]`. */
export type ParseCteColumnList<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"("> ? ParseCteColumnNames<SkipToken<Tokens>, []> : [Tokens, null]

type ParseCteColumnNames<Tokens extends ParserMonad, Acc extends readonly string[]> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer N extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<",">
				? ParseCteColumnNames<SkipToken<R1>, [...Acc, N]>
				: PeekToken<R1> extends TokenKey<")">
					? [SkipToken<R1>, [...Acc, N]]
					: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_CTE_NAME_IN_WITH"], []>>
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_CTE_NAME_IN_WITH"], []>>

/** Apply the CTE column list (names by position); no list keeps the query's own names. */
export type ApplyCteColumnList<Res extends JsqlSelectStatementResult, Cols> = Cols extends readonly string[]
	? RenameOutputColumns<Res, Cols>
	: Res

/**
 * The parenthesised body of a CTE after `(`. A `WITH RECURSIVE` body may be `non-recursive UNION [ALL] recursive`:
 * the recursive arm sees the CTE under its own name with the non-recursive arm's columns (CORE-12).
 * Returns `[Tokens, Result | error]` after the closing `)`.
 */
type ParseCteBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteName extends string,
	Cols,
	Visible extends ScopeMap,
	Recursive extends boolean,
> = Recursive extends true
	? PeekToken<Tokens> extends TokenKey<"select">
		? ParseSelectArm<SkipToken<Tokens>, Db, Params, Visible, {}> extends [
				infer Ra extends ParserMonad,
				infer _Db2,
				infer Res1,
			]
			? Res1 extends DbtyperErrorShape
				? SkipFailedExpression<Ra, Res1>
				: Res1 extends JsqlSelectStatementResult
					? ApplyCteColumnList<Res1, Cols> extends infer Named
						? Named extends DbtyperErrorShape
							? SkipFailedExpression<Ra, Named>
							: Named extends JsqlSelectStatementResult
								? PeekToken<Ra> extends TokenKey<"union">
									? ParseSetOperationRightArm<
											SkipToken<Ra>,
											Db,
											Params,
											MergeScope<Record<CteName, SelectResultToCteScopeEntry<Named>>, Visible>,
											{}
										> extends [infer Rb extends ParserMonad, infer Res2]
										? Res2 extends DbtyperErrorShape
											? SkipFailedExpression<Rb, Res2>
											: Res2 extends JsqlSelectStatementResult
												? MergeSetOperation<Named, Res2, "UNION"> extends infer Merged
													? Merged extends DbtyperErrorShape
														? SkipFailedExpression<Rb, Merged>
														: ConsumeClosingParen<Rb, Merged>
													: never
												: never
										: never
									: ConsumeClosingParen<Ra, Named>
								: never
						: never
					: never
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>
	: PeekToken<Tokens> extends TokenKey<"insert" | "update" | "delete">
		? DialectFact<Db, "dmlInCte"> extends true
			? ParseCteDml<Tokens, Db, Params, Cols>
			: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>
		: ParseParenEnclosedSelect<Tokens, Db, Params, {}, Visible> extends [infer R4 extends ParserMonad, infer SubOut]
			? SubOut extends JsqlSelectStatementResult
				? ApplyCteColumnList<SubOut, Cols> extends infer Named
					? Named extends DbtyperErrorShape
						? SkipFailedExpression<R4, Named>
						: [R4, Named]
					: never
				: [R4, SubOut]
			: never

/**
 * PGT-26: `WITH x AS (INSERT | UPDATE | DELETE … [RETURNING …])`: the statement is parsed by its own parser (it ends
 * at `)` instead of `;`); the CTE has the RETURNING columns, or none. Returns `[Tokens, Result | error]` after `)`.
 */
type ParseCteDml<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Params extends ExpressionParamsShape, Cols> =
	PeekToken<Tokens> extends TokenKey<"insert">
		? ParseInsert<SkipToken<Tokens>, Db & { cteDml: true }, Params> extends [
				infer R1 extends ParserMonad,
				infer _Db2,
				infer Res,
			]
			? FinishCteDml<R1, Res, Cols>
			: never
		: PeekToken<Tokens> extends TokenKey<"update">
			? ParseUpdate<SkipToken<Tokens>, Db & { cteDml: true }, Params> extends [
					infer R1 extends ParserMonad,
					infer _Db2,
					infer Res,
				]
				? FinishCteDml<R1, Res, Cols>
				: never
			: ParseDelete<SkipToken<Tokens>, Db & { cteDml: true }, Params> extends [
						infer R1 extends ParserMonad,
						infer _Db2,
						infer Res,
				  ]
				? FinishCteDml<R1, Res, Cols>
				: never

/** The RETURNING columns of the data-modifying CTE are its columns (none without RETURNING); then `)`. */
type FinishCteDml<R1 extends ParserMonad, Res, Cols> = Res extends DbtyperErrorShape
	? SkipFailedExpression<R1, Res>
	: Res extends { returning: infer Ret }
		? ApplyCteColumnList<
				{ kind: "select"; returning: Ret extends Record<string, SqlTypeShape> ? Ret : {} },
				Cols
			> extends infer Named
			? Named extends DbtyperErrorShape
				? SkipFailedExpression<R1, Named>
				: ConsumeClosingParen<R1, Named>
			: never
		: never

type ParseSelectWithCtes<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
	OuterScope extends ScopeMap,
	CteBase extends ScopeMap,
	Recursive extends boolean,
> =
	PeekToken<Tokens> extends infer TokCteName
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokCteName extends TokenIdent<infer CteName extends string>
				? CteName extends keyof Acc
					? [R1, Db, FormatError<Errors["DUPLICATE_WITH_CLAUSE_NAME"], []>]
					: ParseCteColumnList<R1> extends [infer R1b extends ParserMonad, infer Cols]
						? Cols extends DbtyperErrorShape
							? [R1b, Db, Cols]
							: PeekToken<R1b> extends TokenKey<"as">
								? SkipToken<R1b> extends infer R2 extends ParserMonad
									? PeekToken<R2> extends TokenKey<"(">
										? SkipToken<R2> extends infer R3 extends ParserMonad
											? ParseCteBody<
													R3,
													Db,
													Params,
													CteName,
													Cols,
													MergeScope<Acc, CteBase>,
													Recursive
												> extends [infer R4 extends ParserMonad, infer SubOut]
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
																OuterScope,
																CteBase,
																Recursive
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
	OnAsts extends readonly ScalarExprAst[] = readonly [],
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
																			Items
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
	Clause extends string = "ORDER BY",
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer Rw extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<Rw, Ast>
			: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
				? R extends DbtyperErrorShape
					? SkipFailedExpression<Rw, WithErrorClause<R, Clause>>
					: R extends SqlTypeShape
						? R["type"] extends "param-probe"
							? Clause extends "LIMIT" | "OFFSET"
								? SkipFailedExpression<Rw, ParamProbeFound<ProbeKeyOf<R>, SqlInteger>>
								: [Rw, null]
							: [Rw, null]
						: SkipFailedExpression<Rw, never>
				: never
		: never

/** `LIMIT <expr>`, or PostgreSQL's `LIMIT ALL` (PGT-23; the dialect phrase `limit all` rejects it in other chains). */
type ParseLimitValue<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"all">
		? [SkipToken<Tokens>, null]
		: ParseOrderByScalarExpr<Tokens, Db, Scope, Params, "LIMIT">

/** SEL-31: a bare identifier that names an output column is that output column (no scope resolution). */
type ParseOrderByTermExpr<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer Rw extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<Rw, Ast>
			: Ast extends { kind: "col"; parts: readonly [infer _N extends OutNames] }
				? [Rw, null]
				: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
					? R extends DbtyperErrorShape
						? SkipFailedExpression<Rw, WithErrorClause<R, "ORDER BY">>
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
	OutNames extends string,
> =
	ParseOrderByTermExpr<Tokens, Db, Scope, Params, OutNames> extends [infer R1 extends ParserMonad, infer E1]
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
	OutNames extends string,
> =
	ParseOrderByOneTerm<Tokens, Db, Scope, Params, OutNames> extends [infer R1 extends ParserMonad, infer E1]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpression<R1, E1>
			: PeekToken<R1> extends TokenKey<",">
				? ParseOrderByTerms<SkipToken<R1>, Db, Scope, Params, OutNames>
				: [R1, null]
		: never

type ParseOrderByAfterOrderKw<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
> =
	PeekToken<R1> extends infer TBy
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? TBy extends TokenKey<"by">
				? ParseOrderByTerms<R2, Db, Scope, Params, OutNames>
				: SkipFailedExpression<R2, FormatError<Errors["EXPECTED_BY_AFTER_ORDER"], []>>
			: never
		: never

type ParseOptionalOrderByTokens<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
> =
	PeekToken<Tokens> extends TokenKey<"order">
		? ParseOrderByAfterOrderKw<SkipToken<Tokens>, Db, Scope, Params, OutNames>
		: [Tokens, null]

type LimitExprThenOptionalOffset<
	Rl1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Rl1> extends TokenKey<"offset">
		? SkipToken<Rl1> extends infer Ro0 extends ParserMonad
			? ParseOrderByScalarExpr<Ro0, Db, Scope, Params, "OFFSET"> extends [infer Ro1 extends ParserMonad, infer Oe]
				? Oe extends DbtyperErrorShape
					? SkipFailedExpression<Ro1, Oe>
					: [Ro1, null]
				: never
			: never
		: PeekToken<Rl1> extends TokenKey<",">
			? DialectFact<Db, "limitComma"> extends true
				? SkipToken<Rl1> extends infer Rc extends ParserMonad
					? ParseOrderByScalarExpr<Rc, Db, Scope, Params, "LIMIT"> extends [
							infer Rc1 extends ParserMonad,
							infer Ce,
						]
						? Ce extends DbtyperErrorShape
							? SkipFailedExpression<Rc1, Ce>
							: [Rc1, null]
						: never
					: never
				: [Rl1, null]
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
			? ParseLimitValue<Rl0, Db, Scope, Params> extends [infer Rl1 extends ParserMonad, infer Le]
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
			? ParseOrderByScalarExpr<R2, Db, Scope, Params, "FETCH"> extends [infer R3 extends ParserMonad, infer E]
				? E extends DbtyperErrorShape
					? SkipFailedExpression<R3, E>
					: ExpectRowOrRowsThenOnly<R3>
				: never
			: never
		: PeekToken<R1> extends TokenKey<"next">
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? ParseOrderByScalarExpr<R2, Db, Scope, Params, "FETCH"> extends [infer R3 extends ParserMonad, infer E]
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
			? ParseLimitValue<Rl0, Db, Scope, Params> extends [infer Rl1 extends ParserMonad, infer Le]
				? Le extends DbtyperErrorShape
					? SkipFailedExpression<Rl1, Le>
					: LimitExprThenOptionalOffset<Rl1, Db, Scope, Params>
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"offset">
			? SkipToken<Tokens> extends infer Ro0 extends ParserMonad
				? ParseOrderByScalarExpr<Ro0, Db, Scope, Params, "OFFSET"> extends [
						infer Ro1 extends ParserMonad,
						infer Oe,
					]
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
			? readonly [R1, { readonly error: WithErrorClause<Rv, "GROUP BY"> }]
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
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
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
			? ParseWhereExpression<Rh, Db, Scope, Params, "HAVING"> extends [infer Rhw extends ParserMonad, infer He]
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
			? ParseWhereExpression<Rh, Db, Scope, Params, "HAVING"> extends [infer Rhw extends ParserMonad, infer He]
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

/** An aggregate call: the `"aggregate"` kind of the function's row in the catalog (src/parser/function-catalog.ts). */
type KnownAggregateName<Db, N extends string, Args extends readonly unknown[]> = IsAggregateCall<
	DialectOf<Db>,
	Lowercase<N>,
	Args["length"]
>

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
	Db,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	GroupKeys extends readonly ScalarExprAst[],
	InsideAgg extends boolean,
> = Args extends readonly [infer A, ...infer R extends readonly (ScalarExprAst | { kind: "star" })[]]
	? A extends { kind: "star" }
		? FnArgsGroupedCheck<Db, R, GroupKeys, InsideAgg>
		: A extends ScalarExprAst
			? ExprValidInsideGroupedSelection<Db, A, GroupKeys, InsideAgg> extends true
				? FnArgsGroupedCheck<Db, R, GroupKeys, InsideAgg>
				: false
			: FnArgsGroupedCheck<Db, R, GroupKeys, InsideAgg>
	: true

type ExprValidInsideGroupedSelection<
	Db,
	Ast extends ScalarExprAst,
	GroupKeys extends readonly ScalarExprAst[],
	InsideAgg extends boolean,
> = InsideAgg extends true
	? true
	: AstEqualsGroupKey<Ast, GroupKeys> extends true
		? true
		: Ast extends
					| { kind: "true" }
					| { kind: "false" }
					| { kind: "sql_null" }
					| { kind: "string" }
					| { kind: "number" }
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
						? KnownAggregateName<Db, N, Args> extends true
							? FnArgsGroupedCheck<Db, Args, GroupKeys, true>
							: FnArgsGroupedCheck<Db, Args, GroupKeys, false>
						: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
							? ExprValidInsideGroupedSelection<Db, I, GroupKeys, false>
							: Ast extends {
										kind: "add"
										left: infer L extends ScalarExprAst
										right: infer R extends ScalarExprAst
								  }
								? TypeBoolAnd<
										ExprValidInsideGroupedSelection<Db, L, GroupKeys, false>,
										ExprValidInsideGroupedSelection<Db, R, GroupKeys, false>
									>
								: Ast extends {
											kind: "sub"
											left: infer Ls extends ScalarExprAst
											right: infer Rs extends ScalarExprAst
									  }
									? TypeBoolAnd<
											ExprValidInsideGroupedSelection<Db, Ls, GroupKeys, false>,
											ExprValidInsideGroupedSelection<Db, Rs, GroupKeys, false>
										>
									: Ast extends {
												kind: "mul"
												left: infer Lm extends ScalarExprAst
												right: infer Rm extends ScalarExprAst
										  }
										? TypeBoolAnd<
												ExprValidInsideGroupedSelection<Db, Lm, GroupKeys, false>,
												ExprValidInsideGroupedSelection<Db, Rm, GroupKeys, false>
											>
										: Ast extends {
													kind: "exp" | "mod"
													left: infer Le extends ScalarExprAst
													right: infer Re extends ScalarExprAst
											  }
											? TypeBoolAnd<
													ExprValidInsideGroupedSelection<Db, Le, GroupKeys, false>,
													ExprValidInsideGroupedSelection<Db, Re, GroupKeys, false>
												>
											: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
												? ExprValidInsideGroupedSelection<Db, In, GroupKeys, false>
												: Ast extends {
															kind: "and" | "or"
															left: infer La extends ScalarExprAst
															right: infer Ra extends ScalarExprAst
													  }
													? TypeBoolAnd<
															ExprValidInsideGroupedSelection<Db, La, GroupKeys, false>,
															ExprValidInsideGroupedSelection<Db, Ra, GroupKeys, false>
														>
													: Ast extends {
																kind: "cmp" | "is_cmp"
																left: infer Lc extends ScalarExprAst
																right: infer Rc extends ScalarExprAst
														  }
														? TypeBoolAnd<
																ExprValidInsideGroupedSelection<
																	Db,
																	Lc,
																	GroupKeys,
																	false
																>,
																ExprValidInsideGroupedSelection<
																	Db,
																	Rc,
																	GroupKeys,
																	false
																>
															>
														: Ast extends {
																	kind: "between"
																	expr: infer Eb extends ScalarExprAst
																	low: infer Lb extends ScalarExprAst
																	high: infer Hb extends ScalarExprAst
															  }
															? TypeBoolAnd<
																	ExprValidInsideGroupedSelection<
																		Db,
																		Eb,
																		GroupKeys,
																		false
																	>,
																	TypeBoolAnd<
																		ExprValidInsideGroupedSelection<
																			Db,
																			Lb,
																			GroupKeys,
																			false
																		>,
																		ExprValidInsideGroupedSelection<
																			Db,
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
																			Db,
																			Ex,
																			GroupKeys,
																			false
																		>,
																		ExprValidInsideGroupedSelection<
																			Db,
																			Pat,
																			GroupKeys,
																			false
																		>
																	>
																: Ast extends {
																			kind: "is_null" | "is_not_null"
																			expr: infer En extends ScalarExprAst
																	  }
																	? ExprValidInsideGroupedSelection<
																			Db,
																			En,
																			GroupKeys,
																			false
																		>
																	: Ast extends {
																				kind: "in_list"
																				expr: infer El extends ScalarExprAst
																				items: infer Ins extends
																					readonly ScalarExprAst[]
																		  }
																		? ExprValidInsideGroupedSelection<
																				Db,
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
																						Db,
																						HIn,
																						GroupKeys,
																						false
																					> extends true
																					? TIn extends readonly []
																						? true
																						: ExprValidInsideGroupedSelection<
																								Db,
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
																					Db,
																					Xc,
																					GroupKeys,
																					false
																				>
																			: Ast extends {
																						kind: "case_simple"
																						discriminant: infer Dsc extends
																							ScalarExprAst
																						arms: infer Arms extends
																							readonly {
																								when: ScalarExprAst
																								then: ScalarExprAst
																							}[]
																						else_: infer El extends
																							ScalarExprAst | null
																				  }
																				? CaseArmsGroupedValid<
																						Db,
																						Arms,
																						GroupKeys
																					> extends true
																					? ExprValidInsideGroupedSelection<
																							Db,
																							Dsc,
																							GroupKeys,
																							false
																						> extends true
																						? El extends ScalarExprAst
																							? ExprValidInsideGroupedSelection<
																									Db,
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
																							Db,
																							Arms2,
																							GroupKeys
																						> extends true
																						? El2 extends ScalarExprAst
																							? ExprValidInsideGroupedSelection<
																									Db,
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
																									Db,
																									B,
																									GroupKeys,
																									false
																								>,
																								ExprValidInsideGroupedSelection<
																									Db,
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
																									Db,
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
																											Db,
																											Lc,
																											GroupKeys,
																											false
																										>,
																										ExprValidInsideGroupedSelection<
																											Db,
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
																											Db,
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
	Db,
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
				ExprValidInsideGroupedSelection<Db, Arm["when"], GroupKeys, false>,
				ExprValidInsideGroupedSelection<Db, Arm["then"], GroupKeys, false>
			>,
			Rest extends readonly [] ? true : CaseArmsGroupedValid<Db, Rest, GroupKeys>
		>
	: true

type ArrayCtorEltsGroupedValid<
	Db,
	Els extends readonly ScalarExprAst[],
	GroupKeys extends readonly ScalarExprAst[],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ExprValidInsideGroupedSelection<Db, H, GroupKeys, false> extends true
		? T extends readonly []
			? true
			: ArrayCtorEltsGroupedValid<Db, T, GroupKeys>
		: false
	: true

type AstContainsAggregateCall<Db, Ast extends ScalarExprAst> = Ast extends {
	kind: "function_call"
	name: infer N extends string
	args: infer Args extends readonly unknown[]
}
	? KnownAggregateName<Db, N, Args> extends true
		? true
		: false
	: Ast extends {
				kind: "add" | "sub" | "mul" | "exp" | "mod"
				left: infer L extends ScalarExprAst
				right: infer R extends ScalarExprAst
		  }
		? AstContainsAggregateCall<Db, L> extends true
			? true
			: AstContainsAggregateCall<Db, R>
		: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
			? AstContainsAggregateCall<Db, I>
			: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
				? AstContainsAggregateCall<Db, In>
				: Ast extends {
							kind: "and" | "or" | "cmp" | "is_cmp"
							left: infer La extends ScalarExprAst
							right: infer Ra extends ScalarExprAst
					  }
					? AstContainsAggregateCall<Db, La> extends true
						? true
						: AstContainsAggregateCall<Db, Ra>
					: Ast extends {
								kind: "between"
								expr: infer Eb extends ScalarExprAst
								low: infer Lb extends ScalarExprAst
								high: infer Hb extends ScalarExprAst
						  }
						? AstContainsAggregateCall<Db, Eb> extends true
							? true
							: AstContainsAggregateCall<Db, Lb> extends true
								? true
								: AstContainsAggregateCall<Db, Hb>
						: Ast extends {
									kind: "like" | "pg_regex_match"
									expr: infer Ex extends ScalarExprAst
									pattern: infer Pat extends ScalarExprAst
							  }
							? AstContainsAggregateCall<Db, Ex> extends true
								? true
								: AstContainsAggregateCall<Db, Pat>
							: Ast extends { kind: "is_null" | "is_not_null"; expr: infer En extends ScalarExprAst }
								? AstContainsAggregateCall<Db, En>
								: Ast extends {
											kind: "in_list"
											expr: infer El extends ScalarExprAst
											items: infer Ins extends readonly ScalarExprAst[]
									  }
									? AstContainsAggregateCall<Db, El> extends true
										? true
										: Ins extends readonly [
													infer H extends ScalarExprAst,
													...infer T extends readonly ScalarExprAst[],
											  ]
											? AstContainsAggregateCall<Db, H> extends true
												? true
												: T extends readonly []
													? false
													: AstContainsAggregateCall<
															Db,
															{ kind: "in_list"; expr: El; items: T }
														>
											: false
									: Ast extends {
												kind: "pg_cast" | "sql_cast"
												expr: infer Ex2 extends ScalarExprAst
										  }
										? AstContainsAggregateCall<Db, Ex2>
										: Ast extends {
													kind: "case_simple"
													discriminant: infer D extends ScalarExprAst
													arms: infer Arms extends readonly {
														when: ScalarExprAst
														then: ScalarExprAst
													}[]
													else_: infer Elc extends ScalarExprAst | null
											  }
											? AstContainsAggregateCall<Db, D> extends true
												? true
												: CaseArmsContainAgg<Db, Arms> extends true
													? true
													: Elc extends ScalarExprAst
														? AstContainsAggregateCall<Db, Elc>
														: false
											: Ast extends {
														kind: "case_searched"
														arms: infer Arms2 extends readonly {
															when: ScalarExprAst
															then: ScalarExprAst
														}[]
														else_: infer Elc2 extends ScalarExprAst | null
												  }
												? CaseArmsContainAgg<Db, Arms2> extends true
													? true
													: Elc2 extends ScalarExprAst
														? AstContainsAggregateCall<Db, Elc2>
														: false
												: Ast extends {
															kind: "array_index"
															base: infer B extends ScalarExprAst
															index: infer Id extends ScalarExprAst
													  }
													? AstContainsAggregateCall<Db, B> extends true
														? true
														: AstContainsAggregateCall<Db, Id>
													: Ast extends {
																kind: "array_ctor"
																elements: infer Els extends readonly ScalarExprAst[]
														  }
														? ArrayCtorContainsAgg<Db, Els>
														: Ast extends {
																	kind: "custom_op"
																	left: infer Lc extends ScalarExprAst
																	right: infer Rc extends ScalarExprAst
															  }
															? AstContainsAggregateCall<Db, Lc> extends true
																? true
																: AstContainsAggregateCall<Db, Rc>
															: Ast extends {
																		kind: "in_subquery"
																		expr?: infer Lex extends ScalarExprAst
																  }
																? Lex extends ScalarExprAst
																	? AstContainsAggregateCall<Db, Lex>
																	: false
																: false

type CaseArmsContainAgg<
	Db,
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
> = Arms extends readonly [
	infer Arm extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly {
		when: ScalarExprAst
		then: ScalarExprAst
	}[],
]
	? AstContainsAggregateCall<Db, Arm["when"]> extends true
		? true
		: AstContainsAggregateCall<Db, Arm["then"]> extends true
			? true
			: Rest extends readonly []
				? false
				: CaseArmsContainAgg<Db, Rest>
	: false

type ArrayCtorContainsAgg<Db, Els extends readonly ScalarExprAst[]> = Els extends readonly [
	infer H extends ScalarExprAst,
	...infer T extends readonly ScalarExprAst[],
]
	? AstContainsAggregateCall<Db, H> extends true
		? true
		: T extends readonly []
			? false
			: ArrayCtorContainsAgg<Db, T>
	: false

type SelectItemsNeedGroupedProjRules<
	Db,
	Meta extends SelectGroupClauseMeta,
	Items extends readonly RawSelectItem[],
> = Meta["has_having_clause"] extends true
	? true
	: Meta["have_explicit_group_by"] extends true
		? true
		: RawSelectItemsHaveAggregateCall<Db, Items>

type RawSelectItemsHaveAggregateCall<Db, Items extends readonly RawSelectItem[]> = Items extends readonly [
	infer H extends RawSelectItem,
	...infer R extends readonly RawSelectItem[],
]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? AstContainsAggregateCall<Db, Ast> extends true
			? true
			: RawSelectItemsHaveAggregateCall<Db, R>
		: RawSelectItemsHaveAggregateCall<Db, R>
	: false

/** SEL-28: output-column position of an expression select item (`1` is the first item), `never` otherwise. */
type SelectItemAstAtPosition<
	Items extends readonly RawSelectItem[],
	Pos extends string,
	Counter extends readonly 1[] = readonly [1],
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? `${Counter["length"]}` extends Pos
		? H extends { kind: "expr"; ast: infer A extends ScalarExprAst }
			? A
			: never
		: SelectItemAstAtPosition<R, Pos, readonly [...Counter, 1]>
	: never

/** SEL-28: replace an integer-literal GROUP BY key by the select item at that position. */
type GroupKeysWithPositionsResolved<
	Keys extends readonly ScalarExprAst[],
	Items extends readonly RawSelectItem[],
> = Keys extends readonly [infer K extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? [
			K extends { kind: "number"; raw: infer Raw extends string }
				? SelectItemAstAtPosition<Items, Raw> extends infer A
					? [A] extends [never]
						? K
						: A
					: K
				: K,
			...GroupKeysWithPositionsResolved<R, Items>,
		]
	: readonly []

type AstEqualsGroupKey<Ast extends ScalarExprAst, Keys extends readonly ScalarExprAst[]> = Keys extends readonly [
	infer K extends ScalarExprAst,
	...infer R extends readonly ScalarExprAst[],
]
	? [Ast] extends [K]
		? [K] extends [Ast]
			? true
			: AstEqualsGroupKey<Ast, R>
		: AstEqualsGroupKey<Ast, R>
	: false

type ValidateGroupedSelectItemsAgainstKeys<
	Db,
	Items extends readonly RawSelectItem[],
	GroupKeys extends readonly ScalarExprAst[],
> = Items extends readonly [infer H extends RawSelectItem, ...infer Rest extends readonly RawSelectItem[]]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? ExprValidInsideGroupedSelection<Db, Ast, GroupKeys, false> extends true
			? ValidateGroupedSelectItemsAgainstKeys<Db, Rest, GroupKeys>
			: FormatError<Errors["GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE"], []>
		: H extends { kind: "star" } | { kind: "param" }
			? ValidateGroupedSelectItemsAgainstKeys<Db, Rest, GroupKeys>
			: never
	: true

type GroupedProjValidationOutcome<Db, Items extends readonly RawSelectItem[], Meta extends SelectGroupClauseMeta> =
	DialectFact<Db, "groupByRule"> extends false
		? true // SQLT-28: SQLite allows bare columns next to an aggregate
		: SelectItemsNeedGroupedProjRules<Db, Meta, Items> extends true
			? GroupKeysWithPositionsResolved<Meta["group_key_asts"], Items> extends infer Keys extends
					readonly ScalarExprAst[]
				? ValidateGroupedSelectItemsAgainstKeys<Db, Items, Keys>
				: never
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
			: GroupedProjValidationOutcome<Db, Items, Meta> extends infer V
				? V extends DbtyperErrorShape
					? [T1, Db, V]
					: ParseSelectTrailingClauses<T1, Db, Scope, Params, SelectOutputNames<Res>> extends [
								infer Rt extends ParserMonad,
								infer Te,
						  ]
						? Te extends DbtyperErrorShape
							? [Rt, Db, Te]
							: [Rt, Db, Res]
						: never
				: never
		: never

type SelectOutputNames<Res> = Res extends { returning: infer Ret } ? keyof Ret & string : never

/** Optional `ORDER BY …` then optional paging; does not change projection type (`Res`). */
type ParseSelectTrailingClauses<
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
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? [Tokens, Acc]
		: PeekToken<Tokens> extends TokenKey<"*">
			? ParseRawSelectListAfterItem<SkipToken<Tokens>, Db, Params, OuterScope, [...Acc, { kind: "star" }]>
			: ParseOneRawSelectItem<Tokens, Db, Params, OuterScope> extends [
						infer AfterItem extends ParserMonad,
						infer It,
				  ]
				? It extends DbtyperErrorShape
					? SkipFailedExpression<AfterItem, It>
					: It extends RawSelectItem
						? ParseRawSelectListAfterItem<AfterItem, Db, Params, OuterScope, [...Acc, It]>
						: never
				: never

type ParseRawSelectListAfterItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	Acc extends readonly RawSelectItem[],
> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseRawSelectList<SkipToken<Tokens>, Db, Params, OuterScope, Acc>
		: [Tokens, Acc]

type ParseOneRawSelectExprItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: OuterScope }> extends [
		infer RExpr extends ParserMonad,
		infer Out,
		infer _UpdatedEnv,
	]
		? Out extends DbtyperErrorShape
			? [RExpr, Out]
			: Out extends ScalarExprAst
				? (
						DialectFact<Db, "exprKeys"> extends "text"
							? SourceSpan<PeekToken<Tokens>, PeekToken<RExpr>>
							: ""
					) extends infer Text extends string
					? ParseOptionalAs<RExpr> extends [infer M2 extends ParserMonad, infer As extends string | undefined]
						? As extends string
							? [M2, { kind: "expr"; ast: Out; as: As }]
							: Text extends ""
								? [M2, { kind: "expr"; ast: Out }]
								: Out extends
											| { kind: "col" }
											| { kind: "qualified_table_star" }
											| { kind: "alias_table_star" }
									? [M2, { kind: "expr"; ast: Out }]
									: // SQLT-28: the result key is the expression text as written
										[M2, { kind: "expr"; ast: Out; key: Text }]
						: never
					: never
				: never
		: never

type ParseOneRawSelectItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenParam<string>
		? // parse a full expression (`:x + 1`); a bare `:x` stays a param item
			ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope> extends [infer M2 extends ParserMonad, infer It]
			? It extends { kind: "expr"; ast: { kind: "param"; name: infer P extends string }; as?: infer As }
				? [M2, RawSelectParamItem<P, [As] extends [string] ? As : undefined>]
				: [M2, It]
			: never
		: AsIdent<PeekToken<Tokens>> extends TokenIdent<string>
			? ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope>
			: PeekToken<Tokens> extends infer Head
				? Head extends  // Open question: is this token list needed? See TODO.md ("large enum of tokens in ParseOneRawSelectItem")
						| TokenNumber<string>
						| TokenString<string>
						| TokenParam<string>
						| TokenIndexedParam<string>
						| TokenKey<"(">
						| TokenKey<"true">
						| TokenKey<"false">
						| TokenKey<"null">
						| TokenKey<"-">
						| TokenKey<"not">
						| TokenKey<"cast">
						| TokenKey<"case">
						| TokenKey<"exists">
						| TokenKey<"array">
						| TokenKey<"current_timestamp" | "current_date" | "current_time">
					? ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope>
					: Head extends TokenEotWithDialectError
						? // the text ended at a lexer error (1001-1004): stop here, ApplyStatements reports that error (#116 item 25)
							[Tokens, FormatError<Errors["UNEXPECTED_TOKEN"], ["end of text"]>]
						: never
				: never

type ParseOptionalAs<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"as">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<infer N extends string>
				? // SQLT-28: a SQLite result key is the alias as written
					[SkipToken<R1>, PeekToken<R1> extends { written: infer W extends string } ? W : N]
				: [R1, undefined]
			: never
		: [Tokens, undefined]

/** Row shape of a parsed inner `SELECT` used as a derived table in `FROM` / `JOIN`. */
/** A CTE definition: visible by name in FROM, but not itself a FROM item (see `FromItemsOnly`). */
type SelectResultToCteScopeEntry<Res extends JsqlSelectStatementResult> = {
	schema: "__cte__"
	table: "__subquery__"
	columns: Res["returning"]
}

type CteAsFromEntry<E extends ScopeEntry> = { schema: "__subquery__"; table: E["table"]; columns: E["columns"] }

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
				? AsIdent<PeekToken<Ras>> extends TokenIdent<infer Alias extends string>
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
	CteBase extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, OuterScope, CteBase> extends [
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
				: AsIdent<Tok> extends TokenIdent<infer A extends string>
					? A extends FromFunctionName
						? PeekToken<R1> extends TokenKey<"(">
							? ParseFromFunction<R1, A, Db, Scope, Params>
							: ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
						: ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
					: [
							R1,
							FormatError<Errors["EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM"], []>,
							ParserRefErrorThirdSentinel,
						]
			: never
		: never

/** PGT-32: set-returning functions that may be a FROM item. */
type FromFunctionName = "unnest" | "generate_series"

/**
 * PGT-32: `FROM unnest(array) [AS] alias[(col)]`, `FROM generate_series(a, b[, step]) [AS] alias[(col)]`: a one-column
 * relation of the element type. The call is parsed and resolved by the expression parser (in the scope of the items
 * before it, so a `JOIN unnest(t.tags)` sees `t`); the column is named by the column alias, else the alias, else
 * the function name.
 */
type ParseFromFunction<
	AtParen extends ParserMonad,
	Name extends string,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseCallArgs<SkipToken<AtParen>, readonly [Name], { db: Db; params: Params; outerScope: Scope }> extends [
		infer R extends ParserMonad,
		infer Args,
		infer _Env,
	]
		? Args extends DbtyperErrorShape
			? [R, Args, ParserRefErrorThirdSentinel]
			: Args extends readonly (ScalarExprAst | { kind: "star" })[]
				? ResolveExpressionAST<
						{ kind: "function_call"; name: Name; args: Args },
						Db,
						Scope,
						Params
					> extends infer V
					? V extends DbtyperErrorShape
						? [R, WithErrorClause<V, "FROM">, ParserRefErrorThirdSentinel]
						: V extends SqlTypeShape
							? ParseFromFunctionAlias<
									R,
									Name,
									{ type: V["type"]; arg: V["arg"]; nullable: false },
									Scope
								>
							: never
					: never
				: never
		: never

/** `[AS] alias [(column)]` after a FROM function; no alias keeps the function name. */
type ParseFromFunctionAlias<
	Tokens extends ParserMonad,
	Name extends string,
	Col extends SqlTypeShape,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends FromItemEndToken
		? [Tokens, null, MergeScope<Record<Name, FromFunctionEntry<Name, Col>>, Scope>]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ra extends ParserMonad
				? ParseFromFunctionAliasName<Ra, Col, Scope>
				: never
			: ParseFromFunctionAliasName<Tokens, Col, Scope>

type ParseFromFunctionAliasName<Tokens extends ParserMonad, Col extends SqlTypeShape, Scope extends ScopeMap> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer Alias extends string>
		? SkipToken<Tokens> extends infer Rn extends ParserMonad
			? PeekToken<Rn> extends TokenKey<"(">
				? SkipToken<Rn> extends infer Rc extends ParserMonad
					? AsIdent<PeekToken<Rc>> extends TokenIdent<infer ColName extends string>
						? SkipToken<Rc> extends infer Rd extends ParserMonad
							? PeekToken<Rd> extends TokenKey<")">
								? [
										SkipToken<Rd>,
										null,
										MergeScope<Record<Alias, FromFunctionEntry<ColName, Col>>, Scope>,
									]
								: [Rd, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>, ParserRefErrorThirdSentinel]
							: never
						: [
								Rc,
								FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in the FROM alias"]>,
								ParserRefErrorThirdSentinel,
							]
					: never
				: [Rn, null, MergeScope<Record<Alias, FromFunctionEntry<Alias, Col>>, Scope>]
			: never
		: [Tokens, FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>, ParserRefErrorThirdSentinel]

type FromFunctionEntry<ColName extends string, Col extends SqlTypeShape> = {
	schema: "__subquery__"
	table: "__subquery__"
	columns: Record<ColName, Col>
}

/** A FROM clause with joins as `[rest, error | null, scope]`; also the source list of `UPDATE … FROM` (SQLT-42). */
export type ParseFromJoinScope<
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
					? AsIdent<TokB> extends TokenIdent<infer B extends string>
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
			? ParseAliasAfterCTE<R1, A, CteAsFromEntry<Scope[A]>, Scope>
			: JsqlDbGetData<Db, UnqualifiedSchema<Db, A>, A> extends infer Tbl extends JsqlDataShape
				? ParseAliasAfterTable<R1, UnqualifiedSchema<Db, A>, A, Tbl, Scope>
				: [R1, FormatError<Errors["UNKNOWN_TABLE"], [A, "FROM"]>, ParserRefErrorThirdSentinel]

/** Tokens that end a FROM item without an alias. */
type FromItemEndToken =
	| TokenKey<"returning">
	| TokenKey<"inner">
	| TokenKey<"left">
	| TokenKey<"right">
	| TokenKey<"full">
	| TokenKey<"cross">
	| TokenKey<"natural">
	| TokenKey<"join">
	| TokenKey<"on">
	| TokenKey<"using">
	| TokenKey<"where">
	| TokenKey<"order">
	| TokenKey<"limit">
	| TokenKey<"offset">
	| TokenKey<"fetch">
	| TokenKey<"group">
	| TokenKey<"having">
	| TokenKey<"union">
	| TokenKey<"intersect">
	| TokenKey<"except">
	| TokenIdent<"with"> // `WITH [NO] DATA` after a materialized view's query (PGT-20)
	| TokenKey<")">
	| TokenKey<";">
	| TokenEot

type ParseAliasAfterCTE<
	Tokens extends ParserMonad,
	CteName extends string,
	CteEntry extends ScopeEntry,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends FromItemEndToken
		? [Tokens, null, MergeScope<Record<CteName, CteEntry>, Scope>]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras0 extends ParserMonad
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends ParserMonad
						? AsIdent<TokName> extends TokenIdent<infer Alias extends string>
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
	PeekToken<Tokens> extends FromItemEndToken
		? [
				Tokens,
				null,
				MergeScope<
					Record<
						Tab,
						{
							schema: Sch
							table: Tab
							columns: TableScopeColumns<Tbl>
						}
					>,
					Scope
				>,
			]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras0 extends ParserMonad
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends ParserMonad
						? AsIdent<TokName> extends TokenIdent<infer Alias extends string>
							? [
									Ra,
									null,
									MergeScope<
										Record<
											Alias,
											{
												schema: Sch
												table: Tab
												columns: TableScopeColumns<Tbl>
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
											columns: TableScopeColumns<Tbl>
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
					: PeekToken<Tokens> extends TokenKey<"natural">
						? ParseJoinAfterNatural<SkipToken<Tokens>, Db, Scope, Params>
						: PeekToken<Tokens> extends TokenKey<"cross">
							? ParseJoinAfterCross<SkipToken<Tokens>, Db, Scope, Params>
							: PeekToken<Tokens> extends TokenKey<"join">
								? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "inner">
								: [Tokens, null, Scope]

type NaturalJoinKind<T> =
	T extends TokenKey<"inner">
		? "inner"
		: T extends TokenKey<"left">
			? "left"
			: T extends TokenKey<"right">
				? "right"
				: T extends TokenKey<"full">
					? "full"
					: "none"

/** CORE-9: `NATURAL [INNER | LEFT | RIGHT | FULL [OUTER]] JOIN t`, after `NATURAL`. */
type ParseJoinAfterNatural<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	NaturalJoinKind<PeekToken<Tokens>> extends infer K extends JoinKind | "none"
		? K extends "none"
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "inner", true>
			: SkipToken<Tokens> extends infer R1 extends ParserMonad
				? K extends JoinKind
					? PeekToken<R1> extends TokenKey<"outer">
						? SkipToken<R1> extends infer R2 extends ParserMonad
							? ParseJoinAfterJoinKw<R2, Db, Scope, Params, K, true>
							: never
						: ParseJoinAfterJoinKw<R1, Db, Scope, Params, K, true>
					: never
				: never
		: never

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
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "inner">
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
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "left">
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
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "right">
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["RIGHT"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterRightOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "right">
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
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "full">
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["FULL"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterFullOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "full">
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["FULL OUTER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterOptionalOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "left">
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["LEFT OUTER"]>, ParserRefErrorThirdSentinel]

type JoinKind = "inner" | "left" | "right" | "full"

type NullableScopeEntry<E extends ScopeEntry> = {
	schema: E["schema"]
	table: E["table"]
	columns: {
		[C in keyof E["columns"]]: { type: E["columns"][C]["type"]; arg: E["columns"][C]["arg"]; nullable: true }
	}
	hidden?: HiddenColumnsOf<E>
}

/** SEL-18: columns of the optional side of an outer join are nullable (right of LEFT, left of RIGHT, both of FULL). */
type MarkJoinNullable<Kind extends JoinKind, Old extends ScopeMap, New extends ScopeMap> = Kind extends "inner"
	? New
	: {
			[K in keyof New]: K extends keyof Old
				? Kind extends "right" | "full"
					? NullableScopeEntry<New[K]>
					: New[K]
				: Kind extends "left" | "full"
					? NullableScopeEntry<New[K]>
					: New[K]
		}

type ParseJoinAfterJoinKw<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Kind extends JoinKind,
	Natural extends boolean = false,
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
								? Natural extends true
									? ParseJoinUsingChain<
											R0,
											Db,
											Scope,
											JoinScopeOnly<Third>,
											Kind,
											NaturalJoinColumns<Scope, JoinScopeOnly<Third>>,
											Params
										>
									: PeekToken<R0> extends TokenKey<"using">
										? ParseUsingColumnList<SkipToken<R0>> extends [
												infer R1 extends ParserMonad,
												infer Cols,
											]
											? Cols extends DbtyperErrorShape
												? [R1, Cols, ParserRefErrorThirdSentinel]
												: Cols extends readonly string[]
													? ParseJoinUsingChain<
															R1,
															Db,
															Scope,
															JoinScopeOnly<Third>,
															Kind,
															Cols[number],
															Params
														>
													: never
											: never
										: PeekToken<R0> extends TokenKeyOn
											? ParseJoinOn<
													R0,
													Db,
													MarkJoinNullable<Kind, Scope, JoinScopeOnly<Third>>,
													Params
												>
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

/** `USING (a, b)` column list after `USING`. Returns `[Tokens, names | error]`. */
type ParseUsingColumnList<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseCteColumnNames<SkipToken<Tokens>, []>
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_ON_AFTER_JOIN_TABLE"], []>>

type NewJoinKey<Old extends ScopeMap, Merged extends ScopeMap> = Exclude<keyof Merged, keyof Old>

/** Scope keys (FROM items of the left side) that expose `Col` as a visible column. */
type LeftKeysWithColumn<Old extends ScopeMap, Col extends string> = {
	[K in keyof FromItemsOnly<Old>]: Col extends keyof Old[K]["columns"]
		? Col extends HiddenColumnsOf<Old[K]>
			? never
			: K
		: never
}[keyof FromItemsOnly<Old>]

/** CORE-9: the columns the new join table shares by name with the visible columns of the left side. */
type NaturalJoinColumns<Old extends ScopeMap, Merged extends ScopeMap> =
	NewJoinKey<Old, Merged> extends infer NK extends string
		? [NK] extends [never]
			? never
			: keyof Merged[NK]["columns"] extends infer C
				? C extends string
					? [LeftKeysWithColumn<Old, C>] extends [never]
						? never
						: C
					: never
				: never
		: never

/** Nullability of a merged USING column (CORE-9, SEL-18): FULL is nullable only if both sides are. */
type UsingColumnNullable<Kind extends JoinKind, L extends SqlTypeShape, R extends SqlTypeShape> = Kind extends "right"
	? R["nullable"]
	: Kind extends "full"
		? L["nullable"] extends true
			? R["nullable"]
			: false
		: L["nullable"]

type FirstUsingColumnError<
	Old extends ScopeMap,
	NK extends string,
	Merged extends ScopeMap,
	Cols extends string,
> = Cols extends string
	? [LeftKeysWithColumn<Old, Cols>] extends [never]
		? Cols
		: Cols extends keyof Merged[NK]["columns"]
			? never
			: Cols
	: never

/** The scope after `JOIN … USING (Cols)`: the left column carries the merged nullability, the right one is hidden. */
type ApplyJoinUsing<Kind extends JoinKind, Old extends ScopeMap, Merged extends ScopeMap, Cols extends string> =
	NewJoinKey<Old, Merged> extends infer NK extends string
		? [NK] extends [never]
			? MarkJoinNullable<Kind, Old, Merged>
			: [FirstUsingColumnError<Old, NK, Merged, Cols>] extends [never]
				? MarkJoinNullable<Kind, Old, Merged> extends infer Marked extends ScopeMap
					? {
							[K in keyof Marked]: K extends NK
								? {
										schema: Marked[K]["schema"]
										table: Marked[K]["table"]
										columns: Marked[K]["columns"]
										hidden: Cols | HiddenColumnsOf<Marked[K]>
									}
								: {
										schema: Marked[K]["schema"]
										table: Marked[K]["table"]
										columns: {
											[C in keyof Marked[K]["columns"]]: C extends Cols
												? [LeftKeysWithColumn<Old, C>] extends [K]
													? {
															type: Marked[K]["columns"][C]["type"]
															arg: Marked[K]["columns"][C]["arg"]
															nullable: UsingColumnNullable<
																Kind,
																Old[K & keyof Old]["columns"][C],
																Merged[NK]["columns"][C & keyof Merged[NK]["columns"]]
															>
														}
													: Marked[K]["columns"][C]
												: Marked[K]["columns"][C]
										}
										hidden?: HiddenColumnsOf<Marked[K]>
									}
						}
					: never
				: FormatError<Errors["JOIN_USING_COLUMN_NOT_FOUND"], [FirstUsingColumnError<Old, NK, Merged, Cols>]>
		: never

type ParseJoinUsingChain<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Old extends ScopeMap,
	Merged extends ScopeMap,
	Kind extends JoinKind,
	Cols extends string,
	Params extends ExpressionParamsShape,
> =
	ApplyJoinUsing<Kind, Old, Merged, Cols> extends infer Next
		? Next extends DbtyperErrorShape
			? [Tokens, Next, ParserRefErrorThirdSentinel]
			: Next extends ScopeMap
				? ParseJoinChain<Tokens, Db, Next, Params>
				: never
		: never

/** CORE-10: the ON condition is any boolean expression, checked like a WHERE condition. */
type ParseJoinOn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? ParseWhereExpression<R1, Db, Scope, Params, "JOIN ON"> extends [infer R2 extends ParserMonad, infer Err]
			? Err extends DbtyperErrorShape
				? [R2, Err, ParserRefErrorThirdSentinel]
				: ParseJoinChain<R2, Db, Scope, Params>
			: never
		: never

/**
 * SEL-6: a bare `*` is resolved against the FROM items of this query level only (never the outer
 * scope of a subquery) and must see exactly one of them.
 */
type ResolveSelectListFrom<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	FromScope extends ScopeMap,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Items extends readonly [{ kind: "star" }]
	? SingleAliasScope<FromScope> extends true
		? ScopeEntryOfSingle<FromScope> extends infer E extends ScopeEntry
			? {
					kind: "select"
					returning: VisibleColumnsOf<E>
					order: UnionToStringTuple<keyof VisibleColumnsOf<E> & string>
				}
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
	: ResolveSelectList<Items, Db, Scope, Params> extends infer Res
		? Res extends DbtyperErrorShape
			? Res
			: Res extends JsqlSelectStatementResult
				? SelectItemNames<Items, Scope> extends infer Names extends readonly string[]
					? FirstDuplicateName<Names> extends infer Dup
						? [Dup] extends [never]
							? Res & { order: Names }
							: FormatError<Errors["DUPLICATE_OUTPUT_COLUMN"], [`\`${Dup & string}\``]>
						: never
					: never
				: never
		: never

/** Output column names of a select list in position order (CORE-8 matches set-operation arms by position, CORE-11). */
type StarNames<E extends ScopeEntry> = UnionToStringTuple<keyof VisibleColumnsOf<E> & string>

type SelectItemNames<
	Items extends readonly RawSelectItem[],
	Scope extends ScopeMap,
	AllItems extends readonly RawSelectItem[] = Items,
	Acc extends readonly string[] = [],
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "param"; param: infer P extends string; as?: infer As }
		? SelectItemNames<R, Scope, AllItems, [...Acc, As extends string ? As : P]>
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
			? ItemAs<H> extends infer As
				? Ast extends {
						kind: "qualified_table_star"
						schema: infer Sch extends string
						table: infer Tab extends string
					}
					? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E extends ScopeEntry
						? StarNames<E> extends infer T extends readonly string[]
							? SelectItemNames<R, Scope, AllItems, [...Acc, ...T]>
							: Acc
						: Acc
					: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
						? Al extends keyof Scope
							? StarNames<Scope[Al]> extends infer T extends readonly string[]
								? SelectItemNames<R, Scope, AllItems, [...Acc, ...T]>
								: Acc
							: Acc
						: OutNameFromExprAst<Ast, As, AllItems> extends infer O extends string
							? SelectItemNames<R, Scope, AllItems, [...Acc, O]>
							: Acc
				: Acc
			: Acc
	: Acc

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
	: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts; written: infer W extends string }
		? // SQLT-28: a SQLite result key is the column name as written in the query
			W extends ""
			? OutNameFromParts<P, undefined>
			: W
		: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
			? OutNameFromParts<P, undefined>
			: Ast extends { kind: "function_call" | "window_function"; name: infer N extends string }
				? // SEL-8: PostgreSQL names an unaliased function call (aggregate included) by the function name.
					Lowercase<N>
				: Ast extends { kind: "pg_cast" | "sql_cast"; expr: infer Inner extends ScalarExprAst }
					? // EXPR-24: an unaliased cast is named after the cast operand (`id::uuid` -> `id`).
						OutNameFromExprAst<Inner, undefined, AllItems>
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
			? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, VisibleColumnsOf<E>>, AllItems>
			: FormatError<Errors["UNKNOWN_TABLE"], [Sch, "SELECT ... *"]>
		: FormatError<Errors["UNKNOWN_TABLE"], [Tab, "SELECT ... *"]>
	: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
		? Al extends keyof Scope
			? Scope[Al] extends infer E extends ScopeEntry
				? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, VisibleColumnsOf<E>>, AllItems>
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
				? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, VisibleColumnsOf<E>>, AllItems>
				: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
			? ResolveSelectListExprItem<Ast, ItemAs<H>, R, Db, Scope, Params, Sqls, AllItems>
			: H extends { kind: "param"; param: infer P extends string; as?: infer As }
				? ResolveSelectListParamItem<P, As, R, Db, Scope, Params, Sqls, AllItems>
				: never
	: { kind: "select"; returning: Sqls }

/**
 * The select-list accumulator. Every item merges into the previous record; without forcing, each layer stays a lazy
 * mapped type pointing at the one before, and reading a property after ~50 items exceeds the instantiation depth
 * (TS2589, #105). The properties are resolved right away (inferring from all of them does it), the same shape as
 * ForceProps in src/core/type-utils.ts (#48): required, do not make it lazy.
 */
type MergeStringRecords<A extends Record<string, SqlTypeShape>, B extends Record<string, SqlTypeShape>> = ForceProps<
	MergeRecords<A, B>
>

type SingleAliasScope<Scope extends ScopeMap> = [keyof Scope] extends [never]
	? false
	: [{ [K in keyof Scope]: Exclude<keyof Scope, K> }[keyof Scope]] extends [never]
		? true
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
							? [After, Db, WithErrorClause<Res, "RETURNING">]
							: Res extends JsqlSelectStatementResult
								? [After, Db, Res]
								: never
						: never
				: never
		: never
