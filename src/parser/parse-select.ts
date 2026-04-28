import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenParam,
	TokensList,
} from "../../core/sql-tokens.ts"
import type { HasAmbiguousUnqualifiedColumn, ScopeKeysWithColumn } from "./scope-unqualified-helpers.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"

/** Avoid `extends TokenKey<"on">` — the closing `>` can be parsed as a comparison operator. */
type TokenKeyOn = TokenKey<"on">

export type ParseSelect<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"distinct">
		? ParseSelectAfterDistinct<SkipToken<Tokens>, Db>
		: ParseSelectAfterDistinct<Tokens, Db>

type SelectListStarInvalid<Items extends readonly RawSelectItem[]> = Items extends readonly [
	{ kind: "star" },
	...infer Rest extends readonly RawSelectItem[],
]
	? Rest extends readonly []
		? false
		: true
	: false

type ParseSelectAfterDistinct<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ParseRawSelectList<Tokens> extends [infer AfterList extends TokensList, infer Items]
		? Items extends readonly RawSelectItem[]
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
								? Tail extends never
									? [R, Db, Mid]
									: never
								: Mid extends null
									? Tail extends ScopeMap
										? ResolveSelectList<Items, Db, Tail> extends infer Res
											? Res extends SqlParserError<string>
												? [R, Db, Res]
												: Res extends JsqlSelectStatementResult
													? FinishSelectStatement<R, Db, Res>
													: never
											: never
										: never
									: never
							: never
						: never
					: [AfterList, Db, SqlParserError<"Expected FROM after SELECT list">]
			: never
		: never

type FinishSelectStatement<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Res extends JsqlSelectStatementResult,
> =
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

type RawSelectItem =
	| { kind: "star" }
	| { kind: "param"; param: string; as?: string }
	| {
			kind: "parts"
			parts: readonly [string] | readonly [string, string] | readonly [string, string, string]
			as?: string
	  }

type ParseRawSelectList<Tokens extends TokensList, Acc extends readonly RawSelectItem[] = []> =
	PeekToken<Tokens> extends TokenKey<"from">
		? [Tokens, Acc]
		: PeekToken<Tokens> extends TokenKey<"*">
			? ParseRawSelectListAfterItem<SkipToken<Tokens>, [...Acc, { kind: "star" }]>
			: ParseOneRawSelectItem<Tokens> extends [infer AfterItem extends TokensList, infer It]
				? It extends RawSelectItem
					? ParseRawSelectListAfterItem<AfterItem, [...Acc, It]>
					: never
				: never

type ParseRawSelectListAfterItem<Tokens extends TokensList, Acc extends readonly RawSelectItem[]> =
	PeekToken<Tokens> extends TokenKey<","> ? ParseRawSelectList<SkipToken<Tokens>, Acc> : [Tokens, Acc]

type ParseOneRawSelectItem<Tokens extends TokensList> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenParam<infer P extends string>
			? ParseOptionalAs<R1> extends [infer AfterAs extends TokensList, infer As extends string | undefined]
				? [AfterAs, { kind: "param"; param: P; as?: As }]
				: never
			: Tok extends TokenIdent<infer A extends string>
				? ParseOneRawAfterLeadingIdent<R1, A>
				: never
		: never

type ParseOneRawAfterLeadingIdent<R1 extends TokensList, A extends string> =
	PeekToken<R1> extends TokenKey<".">
		? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<".">]
			? ReadToken<R2> extends [infer R3 extends TokensList, TokenIdent<infer B extends string>]
				? PeekToken<R3> extends TokenKey<".">
					? ReadToken<R3> extends [infer R4 extends TokensList, TokenKey<".">]
						? ReadToken<R4> extends [infer R5 extends TokensList, TokenIdent<infer C extends string>]
							? ParseOptionalAs<R5> extends [
									infer AfterAs extends TokensList,
									infer As extends string | undefined,
								]
								? [AfterAs, { kind: "parts"; parts: readonly [A, B, C]; as?: As }]
								: never
							: never
						: never
					: ParseOptionalAs<R3> extends [
								infer AfterAs extends TokensList,
								infer As extends string | undefined,
						  ]
						? [AfterAs, { kind: "parts"; parts: readonly [A, B]; as?: As }]
						: never
				: never
			: never
		: ParseOptionalAs<R1> extends [infer AfterAs extends TokensList, infer As extends string | undefined]
			? [AfterAs, { kind: "parts"; parts: readonly [A]; as?: As }]
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

type ScopeEntry = {
	schema: string
	table: string
	columns: JsqlTableShape["columns"]
	column_sql_types: Record<string, string>
}

type ScopeMap = { readonly [alias: string]: ScopeEntry }

type MergeScope<A extends ScopeMap, B extends ScopeMap> = A & B

type ParseFromJoinScope<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ParseFromTableRef<Tokens, Db, Scope> extends [infer R0 extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
			? Third extends never
				? [R0, Mid, never]
				: never
			: Mid extends null
				? Third extends ScopeMap
					? ParseJoinChain<R0, Db, Third>
					: never
				: never
		: never

type ParseFromTableRef<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenIdent<infer A extends string>
			? ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
			: [R1, SqlParserError<"Expected table name in FROM">, never]
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
						? ParseAliasAfterTable<R3, Db, A, B, Tbl, Scope>
						: [R3, SqlParserError<"Unknown schema or table in FROM">, never]
					: [R3, SqlParserError<"Expected table name after `.` in FROM">, never]
				: never
			: never
		: ResolveTableShape<Db, Db["defaultSchema"], A> extends infer Tbl extends JsqlTableShape
			? ParseAliasAfterTable<R1, Db, Db["defaultSchema"], A, Tbl, Scope>
			: [R1, SqlParserError<"Unknown table in FROM">, never]

type ResolveTableShape<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> = Sch extends keyof Db["schemas"]
	? Tab extends keyof Db["schemas"][Sch]["tables"]
		? Db["schemas"][Sch]["tables"][Tab]
		: never
	: never

type EmptySqlTypes = Record<string, string>

type SqlTypesOf<Tbl extends JsqlTableShape> = Tbl["column_sql_types"] extends infer S
	? S extends Record<string, string>
		? S
		: EmptySqlTypes
	: EmptySqlTypes

type ParseAliasAfterTable<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
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
				: [Ra, SqlParserError<"Expected alias or join clause after table">, never]
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
		: [Tokens, SqlParserError<"Expected JOIN after INNER">, never]

type ParseJoinAfterLeft<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterOptionalOuter<SkipToken<Tokens>, Db, Scope>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope>
			: [Tokens, SqlParserError<"Expected OUTER or JOIN after LEFT">, never]

type ParseJoinAfterOptionalOuter<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope>
		: [Tokens, SqlParserError<"Expected JOIN after LEFT OUTER">, never]

type ParseJoinAfterJoinKw<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"join">
		? SkipToken<Tokens> extends infer AfterJ extends TokensList
			? ParseFromTableRef<AfterJ, Db, Scope> extends [infer R0 extends TokensList, infer Mid, infer Third]
				? Mid extends SqlParserError<string>
					? Third extends never
						? [R0, Mid, never]
						: never
					: Mid extends null
						? Third extends ScopeMap
							? PeekToken<R0> extends TokenKeyOn
								? ParseJoinOn<R0, Db, Third>
								: [R0, SqlParserError<"Expected ON after JOIN table">, never]
							: never
						: never
				: never
			: never
		: [Tokens, SqlParserError<"Expected JOIN keyword">, never]

type ParseJoinOn<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer TokOn]
		? TokOn extends TokenKeyOn
			? ParseJoinEqPair<R1, Scope> extends [infer R2 extends TokensList, infer Tag]
				? Tag extends SqlParserError<string>
					? [R2, Tag, never]
					: Tag extends true
						? ParseJoinChain<R2, Db, Scope>
						: never
				: never
			: [R1, SqlParserError<"Expected ON keyword">, never]
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

type ValidateCol<Scope extends ScopeMap, Alias extends string, Col extends string> = Alias extends keyof Scope
	? Col extends keyof Scope[Alias]["columns"]
		? true
		: false
	: false

type ResolveSelectList<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
> = ResolveSelectListAcc<Items, Db, Scope, {}, {}>

/** Bound parameter `:name` in the SELECT list — TS type unknown until bound; SQL type reported as unknown. */
type ParamSelectOut<As, P extends string> = As extends string
	? { out: As; ts: unknown; sql: "unknown" }
	: { out: P; ts: unknown; sql: "unknown" }

type ResolveSelectListAcc<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Cols extends Record<string, unknown>,
	Sqls extends Record<string, string>,
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "star" }
		? SingleAliasScope<Scope> extends true
			? ScopeEntryOfSingle<Scope> extends infer E extends ScopeEntry
				? ResolveSelectListAcc<
						R,
						Db,
						Scope,
						MergeRecords<Cols, E["columns"]>,
						MergeStringRecords<Sqls, E["column_sql_types"]>
					>
				: SqlParserError<"SELECT * requires a single FROM table">
			: SqlParserError<"SELECT * requires a single FROM table">
		: H extends {
					kind: "parts"
					parts: infer P extends
						| readonly [string]
						| readonly [string, string]
						| readonly [string, string, string]
					as?: infer As
			  }
			? ResolveOneItem<P, Db, Scope, As> extends infer One
				? One extends SqlParserError<string>
					? One
					: One extends { out: infer O extends string; ts: infer Ts; sql: infer Sql extends string }
						? ResolveSelectListAcc<
								R,
								Db,
								Scope,
								MergeRecords<Cols, Record<O, Ts>>,
								MergeStringRecords<Sqls, Record<O, Sql>>
							>
						: never
				: never
			: H extends { kind: "param"; param: infer P extends string; as?: infer As }
				? ParamSelectOut<As, P> extends {
						out: infer O extends string
						ts: infer Ts
						sql: infer Sql extends string
					}
					? ResolveSelectListAcc<
							R,
							Db,
							Scope,
							MergeRecords<Cols, Record<O, Ts>>,
							MergeStringRecords<Sqls, Record<O, Sql>>
						>
					: never
				: never
	: { kind: "select"; columns: Cols; column_sql_types: Sqls }

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}

type MergeStringRecords<A extends Record<string, string>, B extends Record<string, string>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
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

/** Single-column projection `col` (one string tuple). */
type OneStringProjectionTuple = readonly [string]

type ResolveOneFromTriple<Db extends JsqlDatabaseShape, As, S extends string, T extends string, C extends string> =
	GetColMeta3<Db, S, T, C> extends infer M
		? M extends SqlParserError<string>
			? M
			: M extends { ts: infer Ts; sql: infer Sql extends string }
				? { out: As extends string ? As : C; ts: Ts; sql: Sql }
				: never
		: never

type GetColMeta1Row<E extends ScopeEntry, C extends string, As> =
	GetColMeta1<E, C> extends infer M
		? M extends SqlParserError<string>
			? M
			: M extends { ts: infer Ts; sql: infer Sql extends string }
				? { out: As extends string ? As : C; ts: Ts; sql: Sql }
				: never
		: never

type ResolveOneAliasWhenValidated<
	Scope extends ScopeMap,
	As,
	A extends string,
	C extends string,
> = A extends keyof Scope ? GetColMeta1Row<Scope[A], C, As> : SqlParserError<"Unknown table alias in SELECT">

type ResolveOneFromAliasCol<Scope extends ScopeMap, As, A extends string, C extends string> =
	ValidateCol<Scope, A, C> extends true
		? ResolveOneAliasWhenValidated<Scope, As, A, C>
		: SqlParserError<"Unknown qualified column in SELECT">

type ResolveOneItem<
	P extends readonly [string] | readonly [string, string] | readonly [string, string, string],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	As,
> = P extends readonly [infer S extends string, infer T extends string, infer C extends string]
	? ResolveOneFromTriple<Db, As, S, T, C>
	: P extends readonly [infer A extends string, infer C extends string]
		? ResolveOneFromAliasCol<Scope, As, A, C>
		: P extends OneStringProjectionTuple
			? ResolveOneItemUnqualified<P, Scope, As>
			: never

type ResolveUnqualifiedInSelectScope<P extends OneStringProjectionTuple, Scope extends ScopeMap, As> =
	true extends HasAmbiguousUnqualifiedColumn<Scope, P[0]>
		? SqlParserError<"Ambiguous unqualified column in SELECT">
		: ScopeKeysWithColumn<Scope, P[0]> extends infer U
			? [U] extends [never]
				? SqlParserError<"Unknown unqualified column in SELECT">
				: U extends keyof Scope
					? GetColMeta1Row<Scope[U], P[0], As>
					: never
			: never

type ResolveOneItemUnqualified<
	P extends OneStringProjectionTuple,
	Scope extends ScopeMap,
	As,
> = ResolveUnqualifiedInSelectScope<P, Scope, As>

type GetColMeta3<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string, Col extends string> =
	ResolveTableShape<Db, Sch, Tab> extends infer Tbl extends JsqlTableShape
		? Col extends keyof Tbl["columns"]
			? {
					ts: Tbl["columns"][Col]
					sql: Col extends keyof SqlTypesOf<Tbl> ? SqlTypesOf<Tbl>[Col] : "unknown"
				}
			: SqlParserError<"Unknown column (schema.table.column)">
		: SqlParserError<"Unknown schema or table in SELECT">

type GetColMeta1<E extends ScopeEntry, Col extends string> = Col extends keyof E["columns"]
	? {
			ts: E["columns"][Col]
			sql: Col extends keyof E["column_sql_types"] ? E["column_sql_types"][Col] : "unknown"
		}
	: SqlParserError<"Unknown column">
