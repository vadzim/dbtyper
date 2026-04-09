import type { ReadIdentifier, RemoveTrailingSemicolon, StripIdentifierQuotes, StripSqlComments, ToLower, Trim } from "../parser/sql-parse-primitives.js"
import type { SqlCreateTableToType } from "../parser/sql-create-table.js"
import type { SqlDatabase } from "../sql-schema.js"
import type { SqlParseError } from "../sql-parse-error.js"
import type { SqlMigration } from "./migration.js"

type RecordLike = Record<string, unknown>
type SchemaTables = Record<string, Record<string, unknown>>
type ReadQualifiedIdentifier<S extends string> = ReadIdentifier<Trim<S>> extends [
	infer A extends string,
	infer RestA extends string,
]
	? Trim<RestA> extends `.${infer AfterDot}`
		? ReadIdentifier<AfterDot> extends [infer B extends string, infer RestB extends string]
			? [`${StripIdentifierQuotes<A>}.${StripIdentifierQuotes<B>}`, RestB]
			: [StripIdentifierQuotes<A>, RestA]
		: [StripIdentifierQuotes<A>, RestA]
	: never

type SplitSchemaTable<Name extends string, DefaultSchema extends string = "public"> = Name extends `${infer S}.${infer T}`
	? [S, T]
	: [DefaultSchema, Name]

type NormalizeSql<S extends string> = Trim<RemoveTrailingSemicolon<StripSqlComments<S>>>

type ParseCreateName<S extends string> = ToLower<NormalizeSql<S>> extends `create table if not exists ${infer Rest}`
	? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
		? Name
		: never
	: ToLower<NormalizeSql<S>> extends `create table ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: never

type ParseDropTarget<S extends string> = ToLower<NormalizeSql<S>> extends `drop table if exists ${infer Rest}`
	? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
		? Name
		: never
	: ToLower<NormalizeSql<S>> extends `drop table ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: never

type ParseAlterTarget<S extends string> = ToLower<NormalizeSql<S>> extends `alter table if exists ${infer Rest}`
	? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
		? Name
		: never
	: ToLower<NormalizeSql<S>> extends `alter table ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: never

type NormalizeCreateForRow<S extends string> = NormalizeSql<S> extends `create table if not exists ${infer Rest}`
	? `create table ${Rest}`
	: NormalizeSql<S>

type IsCreateIfNotExists<S extends string> =
	ToLower<NormalizeSql<S>> extends `create table if not exists ${string}` ? true : false
type IsDropIfExists<S extends string> = ToLower<NormalizeSql<S>> extends `drop table if exists ${string}` ? true : false
type IsAlterIfExists<S extends string> = ToLower<NormalizeSql<S>> extends `alter table if exists ${string}` ? true : false

type MergeSchemas<
	Schemas extends SchemaTables,
	Schema extends string,
	Table extends string,
	Row,
> = {
	// Inline mapped expansion is intentional for API/tooling: keep merged schema map expanded for hover visibility.
	[K in keyof (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? { [P in keyof (Extract<Schemas[K2], RecordLike> & { [T in Table]: Row })]: (Extract<Schemas[K2], RecordLike> & { [T in Table]: Row })[P] }
			: { [T in Table]: Row }
	})]: (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? { [P in keyof (Extract<Schemas[K2], RecordLike> & { [T in Table]: Row })]: (Extract<Schemas[K2], RecordLike> & { [T in Table]: Row })[P] }
			: { [T in Table]: Row }
	})[K]
}

type DropFromSchemas<
	Schemas extends SchemaTables,
	Schema extends string,
	Table extends string,
> = Schema extends keyof Schemas
	? {
		// Inline mapped expansion is intentional for API/tooling: keep post-drop schema map expanded for hover visibility.
		[K in keyof (Omit<Schemas, Schema> & { [K2 in Schema]: Omit<Extract<Schemas[K2], RecordLike>, Table> })]: (Omit<Schemas, Schema> & { [K2 in Schema]: Omit<Extract<Schemas[K2], RecordLike>, Table> })[K]
	}
	: Schemas

type TableExists<Schemas extends SchemaTables, Schema extends string, Table extends string> = Schema extends keyof Schemas
	? Table extends keyof Extract<Schemas[Schema], RecordLike>
		? true
		: false
	: false

type BuildSchemaObjects<Schemas extends SchemaTables> = {
	[K in keyof Schemas]: {
		readonly kind: "schema"
		readonly tables: Schemas[K]
		readonly __refs: never
	}
}

type ExtractMigrationId<Path extends string> = Path extends `${string}/${infer Last}`
	? Last extends `${infer Name}.${string}`
		? Name
		: Last
	: Path extends `${infer Name}.${string}`
		? Name
		: Path

type AppendMigrationRecord<
	Rec extends Record<string, string>,
	M extends SqlMigration<string, string>,
> = Rec & { [K in ExtractMigrationId<M["path"]>]: M["sql"] }

type ApplyCreate<
	Schemas extends SchemaTables,
	Sql extends string,
> = ParseCreateName<Sql> extends infer QName extends string
	? SplitSchemaTable<QName> extends [infer Schema extends string, infer Table extends string]
		? SqlCreateTableToType<NormalizeCreateForRow<Sql>> extends infer Row
			? Row extends SqlParseError<string>
				? Row
				: TableExists<Schemas, Schema, Table> extends true
					? IsCreateIfNotExists<Sql> extends true
						? Schemas
						: SqlParseError<`Duplicate table name: ${QName}`>
					: MergeSchemas<Schemas, Schema, Table, Row>
			: SqlParseError<"Unable to parse CREATE TABLE migration">
		: SqlParseError<"Unable to parse CREATE TABLE migration target">
	: SqlParseError<"Unable to parse CREATE TABLE migration target">

type ApplyDrop<
	Schemas extends SchemaTables,
	Sql extends string,
> = ParseDropTarget<Sql> extends infer QName extends string
	? SplitSchemaTable<QName> extends [infer Schema extends string, infer Table extends string]
		? TableExists<Schemas, Schema, Table> extends true
			? DropFromSchemas<Schemas, Schema, Table>
			: IsDropIfExists<Sql> extends true
				? Schemas
				: SqlParseError<`Unknown dropped table "${QName}" in database`>
		: SqlParseError<"Unable to parse DROP TABLE migration target">
	: SqlParseError<"Unable to parse DROP TABLE migration target">

type ApplyAlter<
	Schemas extends SchemaTables,
	Sql extends string,
> = ParseAlterTarget<Sql> extends infer QName extends string
	? SplitSchemaTable<QName> extends [infer Schema extends string, infer Table extends string]
		? TableExists<Schemas, Schema, Table> extends true
			? Schemas
			: IsAlterIfExists<Sql> extends true
				? Schemas
				: SqlParseError<`Unknown altered table "${QName}" in database`>
		: SqlParseError<"Unable to parse ALTER TABLE migration target">
	: SqlParseError<"Unable to parse ALTER TABLE migration target">

type ApplyMigrationSql<Schemas extends SchemaTables, Sql extends string> = ToLower<NormalizeSql<Sql>> extends `create table ${string}`
	? ApplyCreate<Schemas, Sql>
	: ToLower<NormalizeSql<Sql>> extends `drop table ${string}`
		? ApplyDrop<Schemas, Sql>
		: ToLower<NormalizeSql<Sql>> extends `alter table ${string}`
			? ApplyAlter<Schemas, Sql>
			: SqlParseError<"Only CREATE TABLE / ALTER TABLE / DROP TABLE migrations are supported for now">

type ApplyMigrationList<
	List extends readonly SqlMigration<string, string>[],
	Schemas extends SchemaTables = {},
	Err = never,
	Rec extends Record<string, string> = {},
> = List extends readonly [infer Head, ...infer Tail]
	? Head extends SqlMigration<string, string>
		? Tail extends readonly SqlMigration<string, string>[]
			? ApplyMigrationSql<Schemas, Head["sql"]> extends infer Next
				? Next extends SqlParseError<string>
					? ApplyMigrationList<Tail, Schemas, Err | Next, AppendMigrationRecord<Rec, Head>>
					: ApplyMigrationList<Tail, Extract<Next, SchemaTables>, Err, AppendMigrationRecord<Rec, Head>>
				: SqlParseError<"Internal migration reducer error">
			: SqlParseError<"Internal migration reducer error">
		: SqlParseError<"Internal migration reducer error">
	: { schemas: Schemas; error: Err; migrations: Rec }

type UnwrapMigrationImports<Args extends readonly Promise<{ default: SqlMigration<string, string> }>[]> = {
	[K in keyof Args]: Awaited<Args[K]>["default"]
}

export type SqlMigrationsResult<Args extends readonly Promise<{ default: SqlMigration<string, string> }>[]> =
	ApplyMigrationList<UnwrapMigrationImports<Args>> extends infer Built
		? Built extends { schemas: infer Schemas extends SchemaTables; error: infer E; migrations: infer Rec extends Record<string, string> }
			? [E] extends [never]
				? (
				// Public API return keeps migrations SQL record attached for export/apply pipelines.
				SqlDatabase<BuildSchemaObjects<Schemas>> & { readonly migrations: Rec }
			)
				: E
			: SqlParseError<"Internal migrations builder error">
		: SqlParseError<"Internal migrations builder error">

export function migrations<Args extends readonly Promise<{ default: SqlMigration<string, string> }>[]>(
	...args: Args
): SqlMigrationsResult<Args> {
	return {
		kind: "database",
		schemas: {},
		migrations: {},
		args,
	} as unknown as SqlMigrationsResult<Args>
}
