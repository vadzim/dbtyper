import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { ValidateCreateTableFkRefs } from "./helpers/validate-fk-refs.js"
import type { MergeSchemas, ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.js"

export type ApplyCreateTable<
	Db extends SqlDatabaseLike,
	Create extends SqlCreateTable,
> = Create["name"] extends infer Name
	? Name extends SqlParseError<string>
		? Name
		: Name extends Create["name"] & (readonly [string] | readonly [string, string])
			? Create["row"] extends infer Row
				? Row extends SqlParseError<string>
					? Row
					: ResolveQualifiedIdentifier<Name, Db["defaultSchema"]> extends [
								infer Schema extends string,
								infer Table extends string,
						  ]
						? Db["schemas"] extends Record<string, Record<string, unknown>>
							? SchemaExists<
									Extract<Db["schemas"], Record<string, Record<string, unknown>>>,
									Schema
								> extends true
								? TableExists<Db["schemas"], Schema, Table> extends true
									? SqlParseError<`Duplicate table name: ${Table}`>
									: ValidateCreateTableFkRefs<Db, Create, Schema, Table> extends infer ValidationError
										? [ValidationError] extends [never]
											? {
													readonly kind: "database"
													readonly defaultSchema: Db["defaultSchema"]
													readonly schemas: MergeSchemas<
														Extract<Db["schemas"], Record<string, Record<string, unknown>>>,
														Schema,
														Table,
														Row
													>
												}
											: ValidationError extends SqlParseError<string>
												? ValidationError
												: SqlParseError<"Internal SqlApplyCreateTable error">
										: SqlParseError<"Internal SqlApplyCreateTable error">
								: SqlParseError<`Unknown schema "${Schema}" (use CREATE SCHEMA first)`>
							: SqlParseError<"Internal SqlApplyCreateTable schema shape error">
						: SqlParseError<"Internal SqlApplyCreateTable target error">
				: SqlParseError<"Internal SqlApplyCreateTable row error">
			: SqlParseError<"Internal SqlApplyCreateTable name error">
	: SqlParseError<"Internal SqlApplyCreateTable error">
