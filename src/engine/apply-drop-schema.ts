import type { DropSchemaStatement } from "../parser/sql-drop-schema.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { DropSchemaFromSchemas, SchemaExists } from "./helpers/engine-helpers.js"

export type ApplyDropSchema<Db extends SqlDatabaseLike, Drop extends DropSchemaStatement> =
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
				: SqlParserError<`Unknown dropped schema "${Drop["name"]}" in database`>
		: SqlParserError<"Internal SqlApplyDropSchema schema shape error">
