import type { CreateSchemaStatement } from "../parser/parse-create-schema.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { JsqlDatabaseShape, JsqlSchemaShape } from "./jsql-shapes.ts"
import type { SchemaExists } from "./helpers/engine-helpers.ts"

export type ApplyCreateSchema<Db extends JsqlDatabaseShape, Create extends CreateSchemaStatement> =
	Db["schemas"] extends Record<string, JsqlSchemaShape>
		? SchemaExists<Extract<Db["schemas"], Record<string, JsqlSchemaShape>>, Create["name"]> extends true
			? Create["ifNotExists"] extends true
				? Db
				: SqlParserError<`Duplicate schema name: ${Create["name"]}`>
			: {
					defaultSchema: Db["defaultSchema"]
					schemas: Extract<Db["schemas"], Record<string, JsqlSchemaShape>> & {
						[K in Create["name"]]: { tables: {} }
					}
				}
		: SqlParserError<"Internal SqlApplyCreateSchema schema shape error">
