import type { DropTableStatement } from "../parser/sql-drop-table.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { DropFromSchemas, ResolveQualifiedIdentifier, TableExists } from "./helpers/engine-helpers.js"

export type ApplyDropTable<Db extends SqlDatabaseLike, Drop extends DropTableStatement> =
	ResolveQualifiedIdentifier<Drop["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, Record<string, unknown>>
			? TableExists<Db["schemas"], Schema, Table> extends true
				? {
						readonly kind: "database"
						readonly defaultSchema: Db["defaultSchema"]
						readonly schemas: DropFromSchemas<
							Extract<Db["schemas"], Record<string, Record<string, unknown>>>,
							Schema,
							Table
						>
					}
				: Drop["ifExists"] extends true
					? Db
					: SqlParserError<`Unknown dropped table "${Schema}.${Table}" in database`>
			: SqlParserError<"Internal SqlApplyDropTable schema shape error">
		: SqlParserError<"Internal SqlApplyDropTable target error">
