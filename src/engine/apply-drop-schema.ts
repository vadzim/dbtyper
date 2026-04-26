import type { DropSchemaStatement } from "../parser/parse-drop-schema.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { JsqlDatabaseShape, JsqlSchemaShape } from "./jsql-shapes.ts"
import type { DropSchemaFromSchemas, SchemaExists } from "./helpers/engine-helpers.ts"

export type ApplyDropSchema<Db extends JsqlDatabaseShape, Drop extends DropSchemaStatement> =
	Db["schemas"] extends Record<string, JsqlSchemaShape>
		? SchemaExists<Extract<Db["schemas"], Record<string, JsqlSchemaShape>>, Drop["name"]> extends true
			? {
					defaultSchema: Db["defaultSchema"]
					schemas: DropSchemaFromSchemas<Extract<Db["schemas"], Record<string, JsqlSchemaShape>>, Drop["name"]>
				}
			: Drop["ifExists"] extends true
				? Db
				: SqlParserError<`Unknown dropped schema "${Drop["name"]}" in database`>
		: SqlParserError<"Internal SqlApplyDropSchema schema shape error">
