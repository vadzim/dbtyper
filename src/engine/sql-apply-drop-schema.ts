import type { SqlDropSchemaLike } from "../parser/sql-drop-schema.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { DropSchemaFromSchemas, SchemaExists } from "./sql-engine.js"

export type SqlApplyDropSchema<Db extends SqlDatabaseLike, Drop extends SqlDropSchemaLike> =
	Db["schemas"] extends Record<string, Record<string, unknown>>
		? SchemaExists<Extract<Db["schemas"], Record<string, Record<string, unknown>>>, Drop["name"]> extends true
			? {
					readonly kind: "database"
					readonly defaultSchema: Db["defaultSchema"]
					readonly schemas: DropSchemaFromSchemas<
						Extract<Db["schemas"], Record<string, Record<string, unknown>>>,
						Drop["name"]
					>
				}
			: Drop["ifExists"] extends true
				? Db
				: SqlParseError<`Unknown dropped schema "${Drop["name"]}" in database`>
		: SqlParseError<"Internal SqlApplyDropSchema schema shape error">
