import type { SqlCreateTableLike } from "./parser/sql-create-table.js"
import type { SqlParseError } from "./parser/sql-parse-error.js"
import type { SqlDatabase } from "./engine/sql-database.js"

type RecordLike = Record<string, unknown>
type SchemaTables = Record<string, Record<string, unknown>>

type SplitSchemaTable<
	Name extends string,
	DefaultSchema extends string = "public",
> = Name extends `${infer S}.${infer T}` ? [S, T] : [DefaultSchema, Name]

type TableExists<
	Schemas extends SchemaTables,
	Schema extends string,
	Table extends string,
> = Schema extends keyof Schemas ? (Table extends keyof Extract<Schemas[Schema], RecordLike> ? true : false) : false

type MergeSchemas<Schemas extends SchemaTables, Schema extends string, Table extends string, Row> = {
	// Inline mapped expansion is intentional for API/tooling: keep merged schema map expanded for hover visibility.
	[K in keyof (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? {
					[K3 in keyof (Extract<Schemas[K2], RecordLike> & { [T in Table]: Row })]: (Extract<
						Schemas[K2],
						RecordLike
					> & { [T in Table]: Row })[K3]
				}
			: { [T in Table]: Row }
	})]: (Schemas & {
		[K2 in Schema]: K2 extends keyof Schemas
			? {
					[K3 in keyof (Extract<Schemas[K2], RecordLike> & { [T in Table]: Row })]: (Extract<
						Schemas[K2],
						RecordLike
					> & { [T in Table]: Row })[K3]
				}
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
			[K in keyof (Omit<Schemas, Schema> & {
				[K2 in Schema]: Omit<Extract<Schemas[K2], RecordLike>, Table>
			})]: (Omit<Schemas, Schema> & {
				[K2 in Schema]: Omit<Extract<Schemas[K2], RecordLike>, Table>
			})[K]
		}
	: Schemas

type BuildSchemaObjects<Schemas extends SchemaTables> = {
	[K in keyof Schemas]: {
		readonly kind: "schema"
		readonly tables: Schemas[K]
		readonly __refs: never
	}
}

type DbSchemas<Db> = Db extends { readonly schemas: infer S extends SchemaTables } ? S : never
type DbMigrations<Db> = Db extends { readonly migrations: infer M extends Record<string, string> } ? M : {}

export type SqlApplyAlterTable<Target extends string> = {
	readonly kind: "alter_table"
	readonly target: Target
}

export type SqlApplyDropTable<Target extends string> = {
	readonly kind: "drop_table"
	readonly target: Target
}

export type SqlApplyStatement = SqlCreateTableLike | SqlApplyAlterTable<string> | SqlApplyDropTable<string>

type ApplyCreate<Db, Create extends SqlCreateTableLike> = Create["name"] extends infer Name
	? Name extends SqlParseError<string>
		? Name
		: Name extends string
			? Create["row"] extends infer Row
				? Row extends SqlParseError<string>
					? Row
					: SplitSchemaTable<Name> extends [infer Schema extends string, infer Table extends string]
						? DbSchemas<Db> extends infer Schemas extends SchemaTables
							? TableExists<Schemas, Schema, Table> extends true
								? SqlParseError<`Duplicate table name: ${Name}`>
								: SqlDatabase<
										BuildSchemaObjects<MergeSchemas<Schemas, Schema, Table, Row>>,
										"public",
										DbMigrations<Db>
									>
							: SqlParseError<"Internal SqlApply create schema error">
						: SqlParseError<"Internal SqlApply create target error">
				: SqlParseError<"Internal SqlApply create row error">
			: SqlParseError<"Internal SqlApply create name error">
	: SqlParseError<"Internal SqlApply create error">

type ApplyAlter<Db, Alter extends SqlApplyAlterTable<string>> =
	SplitSchemaTable<Alter["target"]> extends [infer Schema extends string, infer Table extends string]
		? DbSchemas<Db> extends infer Schemas extends SchemaTables
			? TableExists<Schemas, Schema, Table> extends true
				? SqlDatabase<BuildSchemaObjects<Schemas>, "public", DbMigrations<Db>>
				: SqlParseError<`Unknown altered table "${Alter["target"]}" in database`>
			: SqlParseError<"Internal SqlApply alter schema error">
		: SqlParseError<"Internal SqlApply alter target error">

type ApplyDrop<Db, Drop extends SqlApplyDropTable<string>> =
	SplitSchemaTable<Drop["target"]> extends [infer Schema extends string, infer Table extends string]
		? DbSchemas<Db> extends infer Schemas extends SchemaTables
			? TableExists<Schemas, Schema, Table> extends true
				? SqlDatabase<BuildSchemaObjects<DropFromSchemas<Schemas, Schema, Table>>, "public", DbMigrations<Db>>
				: SqlParseError<`Unknown dropped table "${Drop["target"]}" in database`>
			: SqlParseError<"Internal SqlApply drop schema error">
		: SqlParseError<"Internal SqlApply drop target error">

/**
 * Apply one parsed statement to a SqlDatabase shape and return next SqlDatabase type (or SqlParseError).
 */
export type SqlApply<Db, Statement> =
	Statement extends SqlParseError<string>
		? Statement
		: Statement extends SqlCreateTableLike
			? ApplyCreate<Db, Statement>
			: Statement extends SqlApplyAlterTable<string>
				? ApplyAlter<Db, Statement>
				: Statement extends SqlApplyDropTable<string>
					? ApplyDrop<Db, Statement>
					: SqlParseError<"Unsupported SqlApply statement">
