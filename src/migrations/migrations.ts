import type { SqlAlterTable } from "../parser/sql-alter-table.js"
import type { SqlDatabase } from "../engine/sql-schema.js"
import type { SqlApply, SqlApplyAlterTable, SqlApplyDropTable } from "../sql-apply.js"
import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlDropTable } from "../parser/sql-drop-table.js"
import type { NormalizeSql } from "../parser/sql-parse-primitives.js"
import type { ToLower } from "../parser/sql-parse-primitives.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlMigration } from "./migration.js"

type RecordLike = Record<string, unknown>
type SchemaTables = Record<string, Record<string, unknown>>

type SplitSchemaTable<
	Name extends string,
	DefaultSchema extends string = "public",
> = Name extends `${infer S}.${infer T}` ? [S, T] : [DefaultSchema, Name]

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
		? SqlCreateTable<NormalizeSql<Sql>>
		: ToLower<NormalizeSql<Sql>> extends `drop table ${string}`
			? SqlDropTable<NormalizeSql<Sql>> extends infer ParsedDrop
				? ParsedDrop extends SqlParseError<string>
					? ParsedDrop
					: ParsedDrop extends { readonly target: infer Target extends string }
						? SqlApplyDropTable<Target>
						: SqlParseError<"Unable to parse DROP TABLE migration target">
				: SqlParseError<"Unable to parse DROP TABLE migration target">
			: ToLower<NormalizeSql<Sql>> extends `alter table ${string}`
				? SqlAlterTable<NormalizeSql<Sql>> extends infer ParsedAlter
					? ParsedAlter extends SqlParseError<string>
						? ParsedAlter
						: ParsedAlter extends { readonly target: infer Target extends string }
							? SqlApplyAlterTable<Target>
							: SqlParseError<"Unable to parse ALTER TABLE migration target">
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
