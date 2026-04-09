import type { SqlCreateTableLike } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { FlattenDBType, MergeSchemas, ResolveQualifiedIdentifier, TableExists } from "./sql-engine.js"

export type SqlApplyCreateTable<Db extends SqlDatabaseLike, Create extends SqlCreateTableLike> = FlattenDBType<
	Create["name"] extends infer Name
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
								? TableExists<Db["schemas"], Schema, Table> extends true
									? SqlParseError<`Duplicate table name: ${Table}`>
									: {
											readonly kind: "database"
											readonly defaultSchema: Db["defaultSchema"]
											readonly schemas: MergeSchemas<
												Extract<Db["schemas"], Record<string, Record<string, unknown>>>,
												Schema,
												Table,
												Row
											>
										}
								: SqlParseError<"Internal SqlApplyCreateTable schema shape error">
							: SqlParseError<"Internal SqlApplyCreateTable target error">
					: SqlParseError<"Internal SqlApplyCreateTable row error">
				: SqlParseError<"Internal SqlApplyCreateTable name error">
		: SqlParseError<"Internal SqlApplyCreateTable error">
>
