import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenParam,
	TokenString,
	TokensList,
} from "../../core/sql-tokens.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ExprOk,
	IsUnknownOrAny,
	ParseExpressionAST,
	ResolveExpressionAST,
	ScalarExprAst,
	ScalarIdentParts,
} from "./parse-expression.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeEntry, ScopeMap, ValidateCol } from "./parser-scope.ts"
import type { ResolveTableShape } from "./resolve-table-shape.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"

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

export type ParseSelect<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"distinct">
		? ParseSelectAfterDistinct<SkipToken<Tokens>, Db, Params>
		: ParseSelectAfterDistinct<Tokens, Db, Params>

type SelectListStarInvalid<Items extends readonly RawSelectItem[]> = Items extends readonly [
	{ kind: "star" },
	...infer Rest extends readonly RawSelectItem[],
]
	? Rest extends readonly []
		? false
		: true
	: false

type ParseSelectAfterDistinct<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseRawSelectList<Tokens, Db, Params> extends [infer AfterList extends TokensList, infer Items]
		? Items extends SqlParserError<string>
			? [AfterList, Db, Items]
			: Items extends readonly RawSelectItem[]
				? SelectListStarInvalid<Items> extends true
					? [AfterList, Db, SqlParserError<"SELECT * must be the only projection in the list">]
					: PeekToken<AfterList> extends TokenKey<"from">
						? SkipToken<AfterList> extends infer AfterFrom extends TokensList
							? ParseFromJoinScope<AfterFrom, Db, {}> extends [
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
														: FinishSelectStatement<R, Db, Res>
													: never
												: never
										: never
								: never
							: never
						: [AfterList, Db, SqlParserError<"Expected FROM after SELECT list">]
				: never
		: never

type FinishSelectStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape, Res> =
	SkipOptionalWhereToSemi<Tokens> extends [infer R1 extends TokensList, null]
		? ReadToken<R1> extends [infer R2 extends TokensList, infer Tok]
			? Tok extends TokenKey<";"> | TokenEot
				? [R2, Db, Res]
				: [R2, Db, SqlParserError<"Expected semicolon after SELECT">]
			: never
		: never

type SkipOptionalWhereToSemi<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"where">
		? SkipBracketedUntil<SkipToken<Tokens>, TokenKey<";">> extends [infer AfterSemi extends TokensList, infer _R]
			? [AfterSemi, null]
			: never
		: [Tokens, null]

type ParseRawSelectList<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends readonly RawSelectItem[] = [],
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? [Tokens, Acc]
		: PeekToken<Tokens> extends TokenKey<"*">
			? ParseRawSelectListAfterItem<SkipToken<Tokens>, Db, Params, [...Acc, { kind: "star" }]>
			: ParseOneRawSelectItem<Tokens, Db, Params> extends [infer AfterItem extends TokensList, infer It]
				? It extends SqlParserError<string>
					? [AfterItem, It]
					: It extends RawSelectItem
						? ParseRawSelectListAfterItem<AfterItem, Db, Params, [...Acc, It]>
						: never
				: never

type ParseRawSelectListAfterItem<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends readonly RawSelectItem[],
> = PeekToken<Tokens> extends TokenKey<","> ? ParseRawSelectList<SkipToken<Tokens>, Db, Params, Acc> : [Tokens, Acc]

type ParseOneRawSelectExprItem<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseExpressionAST<Tokens> extends [infer RExpr extends TokensList, infer Out]
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
> =
	PeekToken<Tokens> extends TokenParam<infer P extends string>
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenParam<P>]
			? ParseOptionalAs<R1> extends [infer M2 extends TokensList, infer As extends string | undefined]
				? [M2, RawSelectParamItem<P, As>]
				: never
			: never
		: PeekToken<Tokens> extends TokenIdent<string>
			? ParseOneRawSelectExprItem<Tokens, Db, Params>
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
					? ParseOneRawSelectExprItem<Tokens, Db, Params>
					: never
				: never

type ParseOptionalAs<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"as">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"as">]
			? ReadToken<R1> extends [infer R2 extends TokensList, TokenIdent<infer N extends string>]
				? [R2, N]
				: ReadToken<R1> extends [infer R2b extends TokensList, infer _T]
					? [R2b, undefined]
					: never
			: ReadToken<Tokens> extends [infer R1b extends TokensList, infer _T]
				? [R1b, undefined]
				: never
		: [Tokens, undefined]

type ParseFromTableRef<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenIdent<infer A extends string>
			? ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
			: [R1, SqlParserError<"Expected table name in FROM">, ParserRefErrorThirdSentinel]
		: never

type ParseFromJoinScope<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ParseFromTableRef<Tokens, Db, Scope> extends [infer R0 extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
			? Third extends ParserRefErrorThirdSentinel
				? [R0, Mid, ParserRefErrorThirdSentinel]
				: never
			: Mid extends null
				? [JoinScopeOnly<Third>] extends [never]
					? never
					: JoinScopeOnly<Third> extends ScopeMap
						? ParseJoinChain<R0, Db, JoinScopeOnly<Third>>
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
		? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<".">]
			? ReadToken<R2> extends [infer R3 extends TokensList, infer TokB]
				? TokB extends TokenIdent<infer B extends string>
					? ResolveTableShape<Db, A, B> extends infer Tbl extends JsqlTableShape
						? ParseAliasAfterTable<R3, A, B, Tbl, Scope>
						: [R3, SqlParserError<"Unknown schema or table in FROM">, ParserRefErrorThirdSentinel]
					: [R3, SqlParserError<"Expected table name after `.` in FROM">, ParserRefErrorThirdSentinel]
				: never
			: never
		: ResolveTableShape<Db, Db["defaultSchema"], A> extends infer Tbl extends JsqlTableShape
			? ParseAliasAfterTable<R1, Db["defaultSchema"], A, Tbl, Scope>
			: [R1, SqlParserError<"Unknown table in FROM">, ParserRefErrorThirdSentinel]

type EmptySqlTypes = Record<string, string>

type SqlTypesOf<Tbl extends JsqlTableShape> = Tbl["column_sql_types"] extends infer S
	? S extends Record<string, string>
		? S
		: EmptySqlTypes
	: EmptySqlTypes

type ParseAliasAfterTable<
	Tokens extends TokensList,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends
		| TokenKey<"inner">
		| TokenKey<"left">
		| TokenKey<"join">
		| TokenKey<"where">
		| TokenKey<";">
		| TokenEot
		? [
				Tokens,
				null,
				MergeScope<
					Scope,
					Record<
						Tab,
						{
							schema: Sch
							table: Tab
							columns: Tbl["columns"]
							column_sql_types: SqlTypesOf<Tbl>
						}
					>
				>,
			]
		: PeekToken<Tokens> extends TokenKey<"as">
			? ReadToken<SkipToken<Tokens>> extends [infer Ra extends TokensList, infer TokName]
				? TokName extends TokenIdent<infer Alias extends string>
					? [
							Ra,
							null,
							MergeScope<
								Scope,
								Record<
									Alias,
									{
										schema: Sch
										table: Tab
										columns: Tbl["columns"]
										column_sql_types: SqlTypesOf<Tbl>
									}
								>
							>,
						]
					: [Ra, SqlParserError<"Expected alias name after AS">, ParserRefErrorThirdSentinel]
				: never
			: ReadToken<Tokens> extends [infer Ra extends TokensList, infer TokAlias]
				? TokAlias extends TokenIdent<infer Alias extends string>
					? [
							Ra,
							null,
							MergeScope<
								Scope,
								Record<
									Alias,
									{
										schema: Sch
										table: Tab
										columns: Tbl["columns"]
										column_sql_types: SqlTypesOf<Tbl>
									}
								>
							>,
						]
					: [Ra, SqlParserError<"Expected alias or join clause after table">, ParserRefErrorThirdSentinel]
				: never

type ParseJoinChain<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"inner">
		? ParseJoinAfterOptionalInner<SkipToken<Tokens>, Db, Scope>
		: PeekToken<Tokens> extends TokenKey<"left">
			? ParseJoinAfterLeft<SkipToken<Tokens>, Db, Scope>
			: PeekToken<Tokens> extends TokenKey<"join">
				? ParseJoinAfterJoinKw<Tokens, Db, Scope>
				: [Tokens, null, Scope]

type ParseJoinAfterOptionalInner<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope>
		: [Tokens, SqlParserError<"Expected JOIN after INNER">, ParserRefErrorThirdSentinel]

type ParseJoinAfterLeft<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterOptionalOuter<SkipToken<Tokens>, Db, Scope>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope>
			: [Tokens, SqlParserError<"Expected OUTER or JOIN after LEFT">, ParserRefErrorThirdSentinel]

type ParseJoinAfterOptionalOuter<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope>
		: [Tokens, SqlParserError<"Expected JOIN after LEFT OUTER">, ParserRefErrorThirdSentinel]

type ParseJoinAfterJoinKw<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"join">
		? SkipToken<Tokens> extends infer AfterJ extends TokensList
			? ParseFromTableRef<AfterJ, Db, Scope> extends [infer R0 extends TokensList, infer Mid, infer Third]
				? Mid extends SqlParserError<string>
					? Third extends ParserRefErrorThirdSentinel
						? [R0, Mid, ParserRefErrorThirdSentinel]
						: never
					: Mid extends null
						? [JoinScopeOnly<Third>] extends [never]
							? never
							: JoinScopeOnly<Third> extends ScopeMap
								? PeekToken<R0> extends TokenKeyOn
									? ParseJoinOn<R0, Db, JoinScopeOnly<Third>>
									: [R0, SqlParserError<"Expected ON after JOIN table">, ParserRefErrorThirdSentinel]
								: [R0, SqlParserError<"Expected ON after JOIN table">, ParserRefErrorThirdSentinel]
						: never
				: never
			: never
		: [Tokens, SqlParserError<"Expected JOIN keyword">, ParserRefErrorThirdSentinel]

type ParseJoinOn<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer TokOn]
		? TokOn extends TokenKeyOn
			? ParseJoinEqPair<R1, Scope> extends [infer R2 extends TokensList, infer Tag]
				? Tag extends SqlParserError<string>
					? [R2, Tag, ParserRefErrorThirdSentinel]
					: Tag extends true
						? ParseJoinChain<R2, Db, Scope>
						: never
				: never
			: [R1, SqlParserError<"Expected ON keyword">, ParserRefErrorThirdSentinel]
		: never

type ParseJoinEqPair<Tokens extends TokensList, Scope extends ScopeMap> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, TokenIdent<infer A1 extends string>]
		? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<".">]
			? ReadToken<R2> extends [infer R3 extends TokensList, TokenIdent<infer C1 extends string>]
				? ReadToken<R3> extends [infer R4 extends TokensList, TokenKey<"=">]
					? ReadToken<R4> extends [infer R5 extends TokensList, TokenIdent<infer A2 extends string>]
						? ReadToken<R5> extends [infer R6 extends TokensList, TokenKey<".">]
							? ReadToken<R6> extends [infer R7 extends TokensList, TokenIdent<infer C2 extends string>]
								? ValidateCol<Scope, A1, C1> extends true
									? ValidateCol<Scope, A2, C2> extends true
										? [R7, true]
										: [R7, SqlParserError<"Unknown column in JOIN (right side)">]
									: [R7, SqlParserError<"Unknown column in JOIN (left side)">]
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
	? IsUnknownOrAny<Params[Name]["ts"]> extends true
		? SqlParserError<"Parameter has unknown or any type in SELECT">
		: { ts: Params[Name]["ts"]; sql: Params[Name]["sql"] }
	: SqlParserError<"Unknown query parameter in SELECT">

/** Bound parameter `:name` in the SELECT list — types come from `Params`. */
type ParamSelectOut<As, P extends string, Ts, Sql extends string> = As extends string
	? { out: As; ts: Ts; sql: Sql }
	: { out: P; ts: Ts; sql: Sql }

type OutNameFromExprAst<
	Ast extends ScalarExprAst,
	As,
	AllItems extends readonly RawSelectItem[],
> = As extends string
	? As
	: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
		? OutNameFromParts<P, undefined>
		: AllItems extends readonly [RawSelectItem]
			? "?column?"
			: "__invalid_select_expr_alias__"

type ResolveSelectListExprItem<
	Ast extends ScalarExprAst,
	As,
	R extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Cols extends Record<string, unknown>,
	Sqls extends Record<string, string>,
	AllItems extends readonly RawSelectItem[],
> =
	ResolveExpressionAST<Ast, Db, Scope, { catalogAccess: "three_part"; params: Params }> extends infer Ev
		? Ev extends SqlParserError<string>
			? Ev
			: Ev extends ExprOk<infer Ts, infer Sql extends string>
				? OutNameFromExprAst<Ast, As, AllItems> extends infer O extends string
					? O extends "__invalid_select_expr_alias__"
						? SqlParserError<"Scalar expression in SELECT requires AS alias">
						: ResolveSelectListAcc<
								R,
								Db,
								Scope,
								Params,
								MergeRecords<Cols, Record<O, Ts>>,
								MergeStringRecords<Sqls, Record<O, Sql>>,
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
	Sqls extends Record<string, string>,
	AllItems extends readonly RawSelectItem[],
> =
	LookupSelectParam<Params, P> extends infer PV
		? PV extends SqlParserError<string>
			? PV
			: PV extends { ts: infer TsP; sql: infer SqlP extends string }
				? ParamSelectOut<As, P, TsP, SqlP> extends {
						out: infer O extends string
						ts: infer Ts
						sql: infer Sql extends string
					}
					? ResolveSelectListAcc<
							R,
							Db,
							Scope,
							Params,
							MergeRecords<Cols, Record<O, Ts>>,
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
	Sqls extends Record<string, string>,
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
						MergeStringRecords<Sqls, E["column_sql_types"]>,
						AllItems
					>
				: SqlParserError<"SELECT * requires a single FROM table">
			: SqlParserError<"SELECT * requires a single FROM table">
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst; as?: infer As }
			? ResolveSelectListExprItem<Ast, As, R, Db, Scope, Params, Cols, Sqls, AllItems>
			: H extends { kind: "param"; param: infer P extends string; as?: infer As }
				? ResolveSelectListParamItem<P, As, R, Db, Scope, Params, Cols, Sqls, AllItems>
				: never
	: { kind: "select"; columns: Cols; column_sql_types: Sqls }

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : unknown
}

type MergeStringRecords<A extends Record<string, string>, B extends Record<string, string>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : string
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
