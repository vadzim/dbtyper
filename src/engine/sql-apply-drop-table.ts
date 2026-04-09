import type { SqlDropTableLike } from "../parser/sql-drop-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { DropFromSchemas, ResolveQualifiedIdentifier, TableExists } from "./sql-engine.js"

export type SqlApplyDropTable<Db extends SqlDatabaseLike, Drop extends SqlDropTableLike> =
	ResolveQualifiedIdentifier<Drop["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends infer Schemas extends Record<string, Record<string, unknown>>
			? TableExists<Schemas, Schema, Table> extends true
				? {
						readonly kind: "database"
						readonly defaultSchema: Db["defaultSchema"]
						readonly schemas: DropFromSchemas<Schemas, Schema, Table>
					}
				: Drop["ifExists"] extends true
					? Db
					: SqlParseError<`Unknown dropped table "${Schema}.${Table}" in database`>
			: SqlParseError<"Internal SqlApplyDropTable schema shape error">
		: SqlParseError<"Internal SqlApplyDropTable target error">
