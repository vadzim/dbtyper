import type { SqlCreateTableLike } from "./parser/sql-create-table.js"
import type { SqlParseError } from "./parser/sql-parse-error.js"
import type { SqlQualifiedIdentifier } from "./parser/sql-parse-primitives.js"
import type { SqlDatabase } from "./engine/sql-database.js"

export type SqlApplyAlterTable<Target extends SqlQualifiedIdentifier> = {
	readonly kind: "alter_table"
	readonly target: Target
}

export type SqlApplyDropTable<Target extends SqlQualifiedIdentifier> = {
	readonly kind: "drop_table"
	readonly target: Target
}

export type SqlApplyStatement =
	| SqlCreateTableLike
	| SqlApplyAlterTable<SqlQualifiedIdentifier>
	| SqlApplyDropTable<SqlQualifiedIdentifier>

/**
 * Apply one parsed statement to a SqlDatabase shape and return next SqlDatabase type (or SqlParseError).
 */
export type SqlApply<Db, Statement> =
	Statement extends SqlParseError<string>
		? Statement
		: Statement extends SqlCreateTableLike
			? ApplyCreate<Db, Statement>
			: Statement extends SqlApplyAlterTable<SqlQualifiedIdentifier>
				? ApplyAlter<Db, Statement>
				: Statement extends SqlApplyDropTable<SqlQualifiedIdentifier>
					? ApplyDrop<Db, Statement>
					: SqlParseError<"Unsupported SqlApply statement">

type RecordLike = Record<string, unknown>
type SchemaTables = Record<string, Record<string, unknown>>

type ResolveQualifiedIdentifier<
	Name extends SqlQualifiedIdentifier,
	DefaultSchema extends string = "public",
> = Name extends readonly [infer Table extends string]
	? [DefaultSchema, Table]
	: Name extends readonly [infer Table extends string, infer Schema extends string]
		? [Schema, Table]
		: never

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
type DbDefaultSchema<Db> = Db extends { readonly defaultSchema: infer D extends string } ? D : "public"

type ApplyCreate<Db, Create extends SqlCreateTableLike> = Create["name"] extends infer Name
	? Name extends SqlParseError<string>
		? Name
		: Name extends SqlQualifiedIdentifier
			? Create["row"] extends infer Row
				? Row extends SqlParseError<string>
					? Row
					: ResolveQualifiedIdentifier<Name, DbDefaultSchema<Db>> extends [
								infer Schema extends string,
								infer Table extends string,
						  ]
						? DbSchemas<Db> extends infer Schemas extends SchemaTables
							? TableExists<Schemas, Schema, Table> extends true
								? SqlParseError<`Duplicate table name: ${Table}`>
								: SqlDatabase<
										BuildSchemaObjects<MergeSchemas<Schemas, Schema, Table, Row>>,
										DbDefaultSchema<Db>,
										DbMigrations<Db>
									>
							: SqlParseError<"Internal SqlApply create schema error">
						: SqlParseError<"Internal SqlApply create target error">
				: SqlParseError<"Internal SqlApply create row error">
			: SqlParseError<"Internal SqlApply create name error">
	: SqlParseError<"Internal SqlApply create error">

type ApplyAlter<Db, Alter extends SqlApplyAlterTable<SqlQualifiedIdentifier>> =
	ResolveQualifiedIdentifier<Alter["target"], DbDefaultSchema<Db>> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? DbSchemas<Db> extends infer Schemas extends SchemaTables
			? TableExists<Schemas, Schema, Table> extends true
				? SqlDatabase<BuildSchemaObjects<Schemas>, DbDefaultSchema<Db>, DbMigrations<Db>>
				: SqlParseError<`Unknown altered table "${Schema}.${Table}" in database`>
			: SqlParseError<"Internal SqlApply alter schema error">
		: SqlParseError<"Internal SqlApply alter target error">

type ApplyDrop<Db, Drop extends SqlApplyDropTable<SqlQualifiedIdentifier>> =
	ResolveQualifiedIdentifier<Drop["target"], DbDefaultSchema<Db>> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? DbSchemas<Db> extends infer Schemas extends SchemaTables
			? TableExists<Schemas, Schema, Table> extends true
				? SqlDatabase<
						BuildSchemaObjects<DropFromSchemas<Schemas, Schema, Table>>,
						DbDefaultSchema<Db>,
						DbMigrations<Db>
					>
				: SqlParseError<`Unknown dropped table "${Schema}.${Table}" in database`>
			: SqlParseError<"Internal SqlApply drop schema error">
		: SqlParseError<"Internal SqlApply drop target error">
