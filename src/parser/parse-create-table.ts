import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokensList,
} from "../../core/sql-tokens.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"

export type ParseCreateTable<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends TokensList
					? PeekToken<A1> extends TokenKey<"exists">
						? SkipToken<A1> extends infer A2 extends TokensList
							? ParseCreateTableQualified<A2, Db, true>
							: never
						: [A1, Db, SqlParserError<"Expected `exists` after `IF NOT` in CREATE TABLE">]
					: never
				: [A0, Db, SqlParserError<"Expected `not` after `IF` in CREATE TABLE">]
			: never
		: ParseCreateTableQualified<Tokens, Db, false>

type ColumnTriple = readonly [string, unknown, string]

/** True when `Tab` is already a concrete key of `sets` (not an open-ended index signature). */
type HasConcreteSet<Sets extends object, Tab extends string> = string extends keyof Sets
	? false
	: Tab extends keyof Sets
		? true
		: false

/**
 * True when `Sch` is a real schema key on this DB (not satisfied only by an open `schemas` index signature).
 * `defaultSchema` is only used to resolve unqualified table names; it must still name an existing `schemas` entry.
 */
type HasConcreteSchemaKey<Db extends JsqlDatabaseShape, Sch extends string> = string extends keyof Db["schemas"]
	? false
	: Sch extends keyof Db["schemas"]
		? true
		: false

type ParseCreateTableQualifiedWhenSchKnown<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
> =
	HasConcreteSet<Db["schemas"][Sch]["sets"], Tab> extends true
		? IfNotExists extends true
			? ParseCreateTableOpenParen<R, Db, Sch, Tab, true>
			: [R, Db, SqlParserError<"Table already exists; use IF NOT EXISTS">]
		: ParseCreateTableOpenParen<R, Db, Sch, Tab, IfNotExists>

type ParseCreateTableQualifiedWhenNameOk<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends string,
	Tab extends string,
> =
	HasConcreteSchemaKey<Db, Sch> extends true
		? ParseCreateTableQualifiedWhenSchKnown<R, Db, IfNotExists, Sch & keyof Db["schemas"] & string, Tab>
		: [R, Db, SqlParserError<"Unknown schema for CREATE TABLE">]

type ParseCreateTableQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	ParseQualifiedTableName<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? E extends null
			? ParseCreateTableQualifiedWhenNameOk<R, Db, IfNotExists, Sch, Tab>
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid CREATE TABLE name parse">]
		: never

/** After `schema.` — one `ReadToken` for the table name, then peek `(`. */
type ParseQualifiedSecondIdent<AfterDot extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	ReadToken<AfterDot> extends [infer R2 extends TokensList, infer Tok2]
		? Tok2 extends TokenIdent<infer B extends string>
			? PeekToken<R2> extends TokenKey<"(">
				? [R2, null, A, B]
				: [R2, SqlParserError<"Expected `(` after qualified table name">, never, never]
			: [R2, SqlParserError<"Expected table name after `.` in qualified table name">, never, never]
		: never

/** After first ident `A` (unqualified or `A.`…). Unqualified names use {@link JsqlDatabaseShape["defaultSchema"]} as the schema key; it must exist under `schemas` (see {@link HasConcreteSchemaKey}). */
type ParseQualifiedAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"(">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: ReadToken<AfterFirst> extends [infer AfterDot extends TokensList, infer Tdot]
			? Tdot extends TokenKey<".">
				? ParseQualifiedSecondIdent<AfterDot, Db, A>
				: [AfterDot, SqlParserError<"Expected `.` or `(` after table name">, never, never]
			: never

/** `[rest, null, schema, table]` on success; `[rest, err, never, never]` on parse failure. */
type ParseQualifiedTableName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer AfterFirst extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer A extends string>
			? ParseQualifiedAfterFirstIdent<AfterFirst, Db, A>
			: [AfterFirst, SqlParserError<"Expected table name in CREATE TABLE">, never, never]
		: never

type ParseCreateTableOpenParen<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	IfNotExists extends boolean,
> =
	ReadToken<Tokens> extends [infer AfterOpen extends TokensList, infer OpenTok]
		? OpenTok extends TokenKey<"(">
			? IfNotExists extends true
				? HasConcreteSet<Db["schemas"][Schema & keyof Db["schemas"]]["sets"], Table> extends true
					? ParseCreateTableBodySkipOnly<AfterOpen, Db>
					: ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
				: ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
			: [AfterOpen, Db, SqlParserError<"Expected `(` before column list in CREATE TABLE">]
		: never

type ParseCreateTableBodySkipOnly<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens, TokenKey<";">> extends [infer AfterSemi extends TokensList, infer R]
		? R extends SqlParserError<string>
			? [AfterSemi, Db, R]
			: [AfterSemi, Db, null]
		: never

/** After `)`, read `;` or end (two sequential `ReadToken`s, tuple patterns only). */
type ParseCreateTableCloseParenAndSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok1]
		? Tok1 extends TokenKey<")">
			? ReadToken<R1> extends [infer R2 extends TokensList, infer Tok2]
				? Tok2 extends TokenKey<";"> | TokenEot
					? [R2, NewDb, null]
					: [R2, NewDb, SqlParserError<"Expected `;` after CREATE TABLE">]
				: never
			: [R1, NewDb, SqlParserError<"Expected `)` before end of CREATE TABLE">]
		: never

type ParseCreateTableBody<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? ColumnsFromStack<Stack> extends infer M extends {
				cols: Record<string, unknown>
				sqls: Record<string, string>
			}
			? MergeTableIntoDb<Db, Schema, Table, M["cols"], M["sqls"]> extends infer NewDb
				? NewDb extends JsqlDatabaseShape
					? ParseCreateTableCloseParenAndSemi<Tokens, NewDb>
					: never
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"constraint">
			? SkipConstraintClause<Tokens> extends [infer AfterC extends TokensList, infer CE]
				? CE extends SqlParserError<string>
					? [AfterC, Db, CE]
					: CE extends null
						? ParseCreateTableBody<AfterC, Db, Schema, Table, Stack>
						: never
				: never
			: ParseOneColumn<Tokens, Db, Schema, Table, Stack>

type ParseOneColumnAfterColName<
	AfterColName extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
> =
	CollectSqlTypeWords<AfterColName> extends [
		infer AfterType extends TokensList,
		infer Words extends readonly string[],
	]
		? TypeWordsToString<Words> extends infer Joined extends string
			? SqlJoinedToTs<Joined> extends infer Ts
				? ResolveAfterNullability<AfterType, Db, Schema, Table, Stack, ColName, Ts, Joined>
				: [AfterType, Db, SqlParserError<"Invalid column type in CREATE TABLE">]
			: [AfterType, Db, SqlParserError<"Invalid column type in CREATE TABLE">]
		: never

type ParseOneColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
> =
	ReadToken<Tokens> extends [infer AfterColName extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer ColName extends string>
			? ParseOneColumnAfterColName<AfterColName, Db, Schema, Table, Stack, ColName>
			: [AfterColName, Db, SqlParserError<"Expected column name in CREATE TABLE">]
		: never

type ResolveAfterNullability<
	AfterType extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	Ts,
	Joined extends string,
> =
	PeekToken<AfterType> extends TokenKey<"not">
		? ReadToken<AfterType> extends [infer R1 extends TokensList, infer T1]
			? T1 extends TokenKey<"not">
				? ReadToken<R1> extends [infer R2 extends TokensList, infer T2]
					? T2 extends TokenKey<"null">
						? ContinueAfterColumnDef<R2, Db, Schema, Table, Stack, ColName, Ts, Joined>
						: [R2, Db, SqlParserError<"Expected `null` after `NOT`">]
					: never
				: [R1, Db, SqlParserError<"Expected `not` after column type">]
			: never
		: PeekToken<AfterType> extends TokenKey<"null">
			? ReadToken<AfterType> extends [infer AfterNull extends TokensList, TokenKey<"null">]
				? ContinueAfterColumnDef<AfterNull, Db, Schema, Table, Stack, ColName, Ts, Joined>
				: never
			: ContinueAfterColumnDef<AfterType, Db, Schema, Table, Stack, ColName, Ts, Joined>

type ContinueAfterColumnDef<
	AfterNull extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	Ts,
	Joined extends string,
> =
	PeekToken<AfterNull> extends TokenKey<",">
		? ReadToken<AfterNull> extends [infer AfterComma extends TokensList, TokenKey<",">]
			? ParseCreateTableBody<AfterComma, Db, Schema, Table, readonly [...Stack, readonly [ColName, Ts, Joined]]>
			: never
		: PeekToken<AfterNull> extends TokenKey<")"> | TokenKey<"constraint">
			? ParseCreateTableBody<AfterNull, Db, Schema, Table, readonly [...Stack, readonly [ColName, Ts, Joined]]>
			: [AfterNull, Db, SqlParserError<"Expected `,` or `)` after column definition">]

type ColPair = { cols: Record<string, unknown>; sqls: Record<string, string> }

type OneCol<C extends ColumnTriple> = C extends readonly [infer N extends string, infer Ts, infer Sql extends string]
	? { cols: Record<N, Ts>; sqls: Record<N, Sql> }
	: never

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}

type MergeColPair<A extends ColPair, B extends ColPair> = {
	cols: MergeRecords<A["cols"], B["cols"]>
	sqls: MergeRecords<A["sqls"], B["sqls"]>
}

/** Batched merge (chunks of 4) to keep conditional-type depth bounded on wide tables. */
type ColumnsFromStack<S extends readonly ColumnTriple[]> = S extends readonly []
	? { cols: {}; sqls: {} }
	: S extends readonly [infer C0 extends ColumnTriple]
		? OneCol<C0>
		: S extends readonly [infer C0 extends ColumnTriple, infer C1 extends ColumnTriple]
			? MergeColPair<OneCol<C0>, OneCol<C1>>
			: S extends readonly [
						infer C0 extends ColumnTriple,
						infer C1 extends ColumnTriple,
						infer C2 extends ColumnTriple,
				  ]
				? MergeColPair<OneCol<C0>, MergeColPair<OneCol<C1>, OneCol<C2>>>
				: S extends readonly [
							infer C0 extends ColumnTriple,
							infer C1 extends ColumnTriple,
							infer C2 extends ColumnTriple,
							infer C3 extends ColumnTriple,
							...infer Rest extends readonly ColumnTriple[],
					  ]
					? Rest extends readonly []
						? MergeColPair<MergeColPair<OneCol<C0>, OneCol<C1>>, MergeColPair<OneCol<C2>, OneCol<C3>>>
						: MergeColPair<
								MergeColPair<
									MergeColPair<OneCol<C0>, OneCol<C1>>,
									MergeColPair<OneCol<C2>, OneCol<C3>>
								>,
								ColumnsFromStack<Rest>
							>
					: { cols: {}; sqls: {} }

export type CollectSqlTypeWords<Tokens extends TokensList, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W]>
		: [Tokens, Acc]

export type TypeWordsToString<A extends readonly string[]> = A extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? H
		: `${H} ${TypeWordsToString<T>}`
	: ""

export type SqlJoinedToTs<Joined extends string> =
	Lowercase<Joined> extends infer K extends string
		? K extends keyof SqlScalarTypeMap
			? SqlScalarTypeMap[K]
			: unknown
		: unknown

type SqlScalarTypeMap = {
	uuid: string
	text: string
	integer: number
	int: number
	bigint: bigint
	smallint: number
	boolean: boolean
	bool: boolean
	numeric: string
	decimal: string
	real: number
	float: number
	"double precision": number
	json: unknown
	jsonb: unknown
	date: string
	timestamp: string
	"timestamp with time zone": string
	"timestamp without time zone": string
	"time with time zone": string
	"time without time zone": string
	"character varying": string
	varchar: string
	char: string
}

type MergeTableIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Cols extends Record<string, unknown>,
	SqlTypes extends Record<string, string>,
> = Schema extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Schema
					? {
							sets: Db["schemas"][K]["sets"] &
								Record<
									Table,
									{
										kind: "table"
										columns: Cols
										column_sql_types: SqlTypes
									}
								>
						}
					: Db["schemas"][K]
			}
		}
	: never

type SkipConstraintAfterKeyTok<AfterKeyTok extends TokensList> =
	ReadToken<AfterKeyTok> extends [infer AfterLp extends TokensList, infer T4]
		? T4 extends TokenKey<"(">
			? SkipBracketedUntil<AfterLp, TokenKey<")">> extends [infer R extends TokensList, infer Res]
				? Res extends SqlParserError<string>
					? [R, Res]
					: [R, null]
				: never
			: [AfterLp, null]
		: never

type SkipConstraintAfterPrim<AfterPrim extends TokensList> =
	ReadToken<AfterPrim> extends [infer AfterKeyTok extends TokensList, infer T3]
		? T3 extends TokenKey<"key">
			? SkipConstraintAfterKeyTok<AfterKeyTok>
			: [AfterKeyTok, null]
		: never

type SkipConstraintAfterName<AfterName extends TokensList> =
	ReadToken<AfterName> extends [infer AfterPrim extends TokensList, infer T2]
		? T2 extends TokenKey<"primary">
			? SkipConstraintAfterPrim<AfterPrim>
			: [AfterPrim, null]
		: never

type SkipConstraintAfterKw<AfterKw extends TokensList> =
	ReadToken<AfterKw> extends [infer AfterName extends TokensList, infer T1]
		? T1 extends TokenIdent<string>
			? SkipConstraintAfterName<AfterName>
			: [AfterName, null]
		: never

type SkipConstraintClause<Tokens extends TokensList> =
	ReadToken<Tokens> extends [infer AfterKw extends TokensList, infer T0]
		? T0 extends TokenKey<"constraint">
			? SkipConstraintAfterKw<AfterKw>
			: [AfterKw, null]
		: never
