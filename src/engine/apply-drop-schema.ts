import type { DropSchemaStatement } from "../parser/parse-drop-schema.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike, SqlSchemaLike } from "./sql-database.ts"
import type { DropSchemaFromSchemas, SchemaExists } from "./helpers/engine-helpers.ts"

export type ApplyDropSchema<Db extends SqlDatabaseLike, Drop extends DropSchemaStatement> =
	Db["schemas"] extends Record<string, SqlSchemaLike>
		? SchemaExists<Extract<Db["schemas"], Record<string, SqlSchemaLike>>, Drop["name"]> extends true
			? {
					kind: "database"
					defaultSchema: Db["defaultSchema"]
					schemas: DropSchemaFromSchemas<Extract<Db["schemas"], Record<string, SqlSchemaLike>>, Drop["name"]>
				}
			: Drop["ifExists"] extends true
				? Db
				: SqlParserError<`Unknown dropped schema "${Drop["name"]}" in database`>
		: SqlParserError<"Internal SqlApplyDropSchema schema shape error">
