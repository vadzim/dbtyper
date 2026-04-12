import type { CreateTableStatement } from "../parser/sql-create-table.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { ValidateCreateTableFkRefs } from "./helpers/validate-fk-refs.js"
import type { MergeSchemas, ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.js"

export type ApplyCreateTable<
	Db extends SqlDatabaseLike,
	Create extends CreateTableStatement,
> = Create["name"] extends infer Name
	? Name extends SqlParserError<string>
		? Name
		: Name extends Create["name"] & (readonly [string] | readonly [string, string])
			? Create["row"] extends infer Row
				? Row extends SqlParserError<string>
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
									? SqlParserError<`Duplicate table name: ${Table}`>
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
											: ValidationError extends SqlParserError<string>
												? ValidationError
												: SqlParserError<"Internal SqlApplyCreateTable error">
										: SqlParserError<"Internal SqlApplyCreateTable error">
								: SqlParserError<`Unknown schema "${Schema}" (use CREATE SCHEMA first)`>
							: SqlParserError<"Internal SqlApplyCreateTable schema shape error">
						: SqlParserError<"Internal SqlApplyCreateTable target error">
				: SqlParserError<"Internal SqlApplyCreateTable row error">
			: SqlParserError<"Internal SqlApplyCreateTable name error">
	: SqlParserError<"Internal SqlApplyCreateTable error">
