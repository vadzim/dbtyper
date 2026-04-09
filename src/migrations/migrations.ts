import type {
	ReadIdentifier,
	RemoveTrailingSemicolon,
	StripIdentifierQuotes,
	StripSqlComments,
	ToLower,
	Trim,
} from "../parser/sql-parse-primitives.js"
import type { SqlDatabase } from "../sql-schema.js"
import type { SqlApply, SqlApplyAlterTable, SqlApplyDropTable } from "../sql-apply.js"
import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../sql-parse-error.js"
import type { SqlMigration } from "./migration.js"

type RecordLike = Record<string, unknown>
type SchemaTables = Record<string, Record<string, unknown>>

type ReadQualifiedIdentifier<S extends string> =
	ReadIdentifier<Trim<S>> extends [infer A extends string, infer RestA extends string]
		? Trim<RestA> extends `.${infer AfterDot}`
			? ReadIdentifier<AfterDot> extends [infer B extends string, infer RestB extends string]
				? [`${StripIdentifierQuotes<A>}.${StripIdentifierQuotes<B>}`, RestB]
				: [StripIdentifierQuotes<A>, RestA]
			: [StripIdentifierQuotes<A>, RestA]
		: never

type SplitSchemaTable<
	Name extends string,
	DefaultSchema extends string = "public",
> = Name extends `${infer S}.${infer T}` ? [S, T] : [DefaultSchema, Name]

type NormalizeSql<S extends string> = Trim<RemoveTrailingSemicolon<StripSqlComments<S>>>

type ParseCreateName<S extends string> =
	ToLower<NormalizeSql<S>> extends `create table if not exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `create table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

type ParseDropTarget<S extends string> =
	ToLower<NormalizeSql<S>> extends `drop table if exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `drop table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

type ParseAlterTarget<S extends string> =
	ToLower<NormalizeSql<S>> extends `alter table if exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `alter table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

type NormalizeCreateForRow<S extends string> =
	NormalizeSql<S> extends `create table if not exists ${infer Rest}` ? `create table ${Rest}` : NormalizeSql<S>

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

type AppendMigrationRecord<Rec extends Record<string, string>, M extends SqlMigration<string, string>> = Rec & {
	[K in ExtractMigrationId<M["path"]>]: M["sql"]
}

type StatementFromSql<Sql extends string> =
	ToLower<NormalizeSql<Sql>> extends `create table ${string}`
		? SqlCreateTable<NormalizeCreateForRow<Sql>>
		: ToLower<NormalizeSql<Sql>> extends `drop table ${string}`
			? ParseDropTarget<Sql> extends infer QName extends string
				? SqlApplyDropTable<QName>
				: SqlParseError<"Unable to parse DROP TABLE migration target">
			: ToLower<NormalizeSql<Sql>> extends `alter table ${string}`
				? ParseAlterTarget<Sql> extends infer QName extends string
					? SqlApplyAlterTable<QName>
					: SqlParseError<"Unable to parse ALTER TABLE migration target">
				: SqlParseError<"Only CREATE TABLE / ALTER TABLE / DROP TABLE migrations are supported for now">

type ApplyOne<
	Schemas extends SchemaTables,
	Rec extends Record<string, string>,
	M extends SqlMigration<string, string>,
> =
	SqlApply<SqlDatabase<BuildSchemaObjects<Schemas>, "public", Rec>, StatementFromSql<M["sql"]>> extends infer Next
		? Next extends SqlParseError<string>
			? Next
			: Next extends SqlDatabase<infer NextSchemas, string, infer NextMigrations>
				? SqlMigrationsBuilder<
						{
							[K in keyof NextSchemas]: Extract<NextSchemas[K], RecordLike>
						},
						Extract<NextMigrations, Record<string, string>> & AppendMigrationRecord<Rec, M>
					>
				: SqlParseError<"Internal migration apply shape error">
		: SqlParseError<"Internal migration apply error">

export type SqlMigrationsBuilder<Schemas extends SchemaTables = {}, Rec extends Record<string, string> = {}> =
	// Public API return keeps migrations SQL record attached for export/apply pipelines.
	SqlDatabase<BuildSchemaObjects<Schemas>, "public", Rec> & {
		apply<Arg>(
			arg: Arg,
		): Arg extends Promise<{ default: infer M extends SqlMigration<string, string> }>
			? ApplyOne<Schemas, Rec, M>
			: SqlParseError<"Invalid migration import">
	}

/** Apply one migration import at a time, updating SqlDatabase type incrementally. */
export function migrations(): SqlMigrationsBuilder<{}, {}> {
	const apply = (_arg: Promise<{ default: SqlMigration<string, string> }>) => {
		return {
			kind: "database",
			schemas: {},
			migrations: {},
			apply,
		} as unknown
	}

	return {
		kind: "database",
		schemas: {},
		migrations: {},
		apply,
	} as unknown as SqlMigrationsBuilder<{}, {}>
}
