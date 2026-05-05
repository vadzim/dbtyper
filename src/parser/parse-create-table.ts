import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type {
	PeekToken,
	SkipToken,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenString,
	TokensList,
} from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ParseQualifiedTableName } from "./parse-qualified-table-name.ts"
import type { CollectSqlTypeWords, TypeWordsToString } from "./parse-sql-type-words.ts"
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

type ColumnTriple = readonly [string, string, boolean, boolean]

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

type ParseCreateTableOpenParen<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	IfNotExists extends boolean,
> =
	PeekToken<Tokens> extends infer OpenTok
		? SkipToken<Tokens> extends infer AfterOpen extends TokensList
			? OpenTok extends TokenKey<"(">
				? IfNotExists extends true
					? HasConcreteSet<Db["schemas"][Schema & keyof Db["schemas"]]["sets"], Table> extends true
						? ParseCreateTableBodySkipOnly<AfterOpen, Db>
						: ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
					: ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
				: [AfterOpen, Db, SqlParserError<"Expected `(` before column list in CREATE TABLE">]
			: never
		: never

type ParseCreateTableBodySkipOnly<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens, TokenKey<";">> extends [infer AfterSemi extends TokensList, infer R]
		? R extends SqlParserError<string>
			? [AfterSemi, Db, R]
			: [AfterSemi, Db, null]
		: never

/** After `)`, read `;` or end. */
type ParseCreateTableCloseParenAndSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok1
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? Tok1 extends TokenKey<")">
				? PeekToken<R1> extends infer Tok2
					? SkipToken<R1> extends infer R2 extends TokensList
						? Tok2 extends TokenKey<";"> | TokenEot
							? [R2, NewDb, null]
							: [R2, NewDb, SqlParserError<"Expected `;` after CREATE TABLE">]
						: never
					: never
				: [R1, NewDb, SqlParserError<"Expected `)` before end of CREATE TABLE">]
			: never
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
				cols: Record<string, string>
				facts: Record<string, unknown>
			}
			? MergeTableIntoDb<Db, Schema, Table, M["cols"], M["facts"]> extends infer NewDb
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
			? ResolveAfterNullability<AfterType, Db, Schema, Table, Stack, ColName, Joined>
			: [AfterType, Db, SqlParserError<"Invalid column type in CREATE TABLE">]
		: never

type ParseOneColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterColName extends TokensList
			? NameTok extends TokenIdent<infer ColName extends string>
				? ParseOneColumnAfterColName<AfterColName, Db, Schema, Table, Stack, ColName>
				: [AfterColName, Db, SqlParserError<"Expected column name in CREATE TABLE">]
			: never
		: never

type ResolveAfterNullability<
	AfterType extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	Joined extends string,
> =
	PeekToken<AfterType> extends TokenKey<"not">
		? SkipToken<AfterType> extends infer R1 extends TokensList
			? PeekToken<R1> extends infer T2
				? SkipToken<R1> extends infer R2 extends TokensList
					? T2 extends TokenKey<"null">
						? ContinueAfterColumnDef<R2, Db, Schema, Table, Stack, ColName, Joined, true>
						: [R2, Db, SqlParserError<"Expected `null` after `NOT`">]
					: never
				: never
			: never
		: PeekToken<AfterType> extends TokenKey<"null">
			? SkipToken<AfterType> extends infer AfterNull extends TokensList
				? ContinueAfterColumnDef<AfterNull, Db, Schema, Table, Stack, ColName, Joined, false>
				: never
			: ContinueAfterColumnDef<AfterType, Db, Schema, Table, Stack, ColName, Joined, false>

type SqlTypeClass<Sql extends string> =
	Lowercase<Sql> extends
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

type ParseDefaultValue<Tokens extends TokensList, ColumnType extends string> =
	PeekToken<Tokens> extends TokenNumber<infer _Raw>
		? SkipToken<Tokens> extends infer R extends TokensList
			? SqlTypeClass<ColumnType> extends "numeric"
				? [R, null]
				: [R, SqlParserError<"DEFAULT value type mismatch: expected numeric column for numeric literal">]
			: never
		: PeekToken<Tokens> extends TokenString<infer _Str>
			? SkipToken<Tokens> extends infer R extends TokensList
				? SqlTypeClass<ColumnType> extends "text" | "uuid" | "unknown"
					? [R, null]
					: [R, SqlParserError<"DEFAULT value type mismatch: expected text/uuid column for string literal">]
				: never
			: PeekToken<Tokens> extends TokenKey<"true"> | TokenKey<"false">
				? SkipToken<Tokens> extends infer R extends TokensList
					? SqlTypeClass<ColumnType> extends "boolean"
						? [R, null]
						: [
								R,
								SqlParserError<"DEFAULT value type mismatch: expected boolean column for boolean literal">,
							]
					: never
				: PeekToken<Tokens> extends TokenKey<"null">
					? SkipToken<Tokens> extends infer R extends TokensList
						? [R, null]
						: never
					: PeekToken<Tokens> extends TokenIdent<infer FnName>
						? ParseDefaultFunctionOrIdent<Tokens, FnName, ColumnType>
						: [Tokens, SqlParserError<"Expected DEFAULT value">]

type ParseDefaultFunctionOrIdent<Tokens extends TokensList, FnName extends string, ColumnType extends string> =
	SkipToken<Tokens> extends infer R1 extends TokensList
		? PeekToken<R1> extends TokenKey<"(">
			? SkipToken<R1> extends infer R2 extends TokensList
				? PeekToken<R2> extends TokenKey<")">
					? SkipToken<R2> extends infer R3 extends TokensList
						? Lowercase<FnName> extends "now"
							? SqlTypeClass<ColumnType> extends "datetime"
								? [R3, null]
								: [R3, SqlParserError<"DEFAULT value type mismatch: now() requires timestamp column">]
							: Lowercase<FnName> extends "uuid_generate_v4" | "gen_random_uuid"
								? SqlTypeClass<ColumnType> extends "uuid"
									? [R3, null]
									: [
											R3,
											SqlParserError<"DEFAULT value type mismatch: UUID function requires uuid column">,
										]
								: [R3, null]
						: never
					: [R2, SqlParserError<"Expected `)` after function name in DEFAULT">]
				: never
			: [R1, null]
		: never

type ContinueAfterColumnDef<
	AfterNull extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	Joined extends string,
	NotNull extends boolean,
> =
	PeekToken<AfterNull> extends TokenKey<"default">
		? SkipToken<AfterNull> extends infer AfterDefault extends TokensList
			? ParseDefaultValue<AfterDefault, Joined> extends [
					infer AfterDefaultVal extends TokensList,
					infer DefaultErr,
				]
				? DefaultErr extends null
					? ContinueAfterDefault<AfterDefaultVal, Db, Schema, Table, Stack, ColName, Joined, NotNull, true>
					: DefaultErr extends SqlParserError<string>
						? [AfterDefaultVal, Db, DefaultErr]
						: never
				: never
			: never
		: PeekToken<AfterNull> extends TokenKey<",">
			? SkipToken<AfterNull> extends infer AfterComma extends TokensList
				? ParseCreateTableBody<
						AfterComma,
						Db,
						Schema,
						Table,
						readonly [...Stack, readonly [ColName, Joined, NotNull, false]]
					>
				: never
			: PeekToken<AfterNull> extends TokenKey<")"> | TokenKey<"constraint">
				? ParseCreateTableBody<
						AfterNull,
						Db,
						Schema,
						Table,
						readonly [...Stack, readonly [ColName, Joined, NotNull, false]]
					>
				: [AfterNull, Db, SqlParserError<"Expected `,` or `)` after column definition">]

type ContinueAfterDefault<
	AfterDefaultVal extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	Joined extends string,
	NotNull extends boolean,
	HasDefault extends boolean,
> =
	PeekToken<AfterDefaultVal> extends TokenKey<",">
		? SkipToken<AfterDefaultVal> extends infer AfterComma extends TokensList
			? ParseCreateTableBody<
					AfterComma,
					Db,
					Schema,
					Table,
					readonly [...Stack, readonly [ColName, Joined, NotNull, HasDefault]]
				>
			: never
		: PeekToken<AfterDefaultVal> extends TokenKey<")"> | TokenKey<"constraint">
			? ParseCreateTableBody<
					AfterDefaultVal,
					Db,
					Schema,
					Table,
					readonly [...Stack, readonly [ColName, Joined, NotNull, HasDefault]]
				>
			: [AfterDefaultVal, Db, SqlParserError<"Expected `,` or `)` after DEFAULT value">]

type ColPair = { cols: Record<string, string>; facts: Record<string, unknown> }

type OneCol<C extends ColumnTriple> = C extends readonly [
	infer N extends string,
	infer Sql extends string,
	infer NotNull extends boolean,
	infer HasDefault extends boolean,
]
	? {
			cols: Record<N, Sql>
			facts: NotNull extends true
				? HasDefault extends true
					? Record<N, { not_null: true; default: true }>
					: Record<N, { not_null: true }>
				: HasDefault extends true
					? Record<N, { default: true }>
					: {}
		}
	: never

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}

type MergeColPair<A extends ColPair, B extends ColPair> = {
	cols: MergeRecords<A["cols"], B["cols"]>
	facts: MergeRecords<A["facts"], B["facts"]>
}

/** Batched merge (chunks of 4) to keep conditional-type depth bounded on wide tables. */
type ColumnsFromStack<S extends readonly ColumnTriple[]> = S extends readonly []
	? { cols: {}; facts: {} }
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
					: { cols: {}; facts: {} }

type MergeTableIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Cols extends Record<string, string>,
	Facts extends Record<string, unknown>,
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
										column_facts: Facts
									}
								>
						}
					: Db["schemas"][K]
			}
		}
	: never

type SkipConstraintAfterKeyTok<AfterKeyTok extends TokensList> =
	PeekToken<AfterKeyTok> extends infer T4
		? SkipToken<AfterKeyTok> extends infer AfterLp extends TokensList
			? T4 extends TokenKey<"(">
				? SkipBracketedUntil<AfterLp, TokenKey<")">> extends [infer R extends TokensList, infer Res]
					? Res extends SqlParserError<string>
						? [R, Res]
						: [R, null]
					: never
				: [AfterLp, null]
			: never
		: never

type SkipConstraintAfterPrim<AfterPrim extends TokensList> =
	PeekToken<AfterPrim> extends infer T3
		? SkipToken<AfterPrim> extends infer AfterKeyTok extends TokensList
			? T3 extends TokenKey<"key">
				? SkipConstraintAfterKeyTok<AfterKeyTok>
				: [AfterKeyTok, null]
			: never
		: never

type SkipConstraintAfterName<AfterName extends TokensList> =
	PeekToken<AfterName> extends infer T2
		? SkipToken<AfterName> extends infer AfterPrim extends TokensList
			? T2 extends TokenKey<"primary">
				? SkipConstraintAfterPrim<AfterPrim>
				: [AfterPrim, null]
			: never
		: never

type SkipConstraintAfterKw<AfterKw extends TokensList> =
	PeekToken<AfterKw> extends infer T1
		? SkipToken<AfterKw> extends infer AfterName extends TokensList
			? T1 extends TokenIdent<string>
				? SkipConstraintAfterName<AfterName>
				: [AfterName, null]
			: never
		: never

type SkipConstraintClause<Tokens extends TokensList> =
	PeekToken<Tokens> extends infer T0
		? SkipToken<Tokens> extends infer AfterKw extends TokensList
			? T0 extends TokenKey<"constraint">
				? SkipConstraintAfterKw<AfterKw>
				: [AfterKw, null]
			: never
		: never
