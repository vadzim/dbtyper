import type { CreateSchemaStatement } from "../parser/parse-create-schema.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike, SqlSchemaLike } from "./sql-database.ts"
import type { SchemaExists } from "./helpers/engine-helpers.ts"

export type ApplyCreateSchema<Db extends SqlDatabaseLike, Create extends CreateSchemaStatement> =
	Db["schemas"] extends Record<string, SqlSchemaLike>
		? SchemaExists<Extract<Db["schemas"], Record<string, SqlSchemaLike>>, Create["name"]> extends true
			? Create["ifNotExists"] extends true
				? Db
				: SqlParserError<`Duplicate schema name: ${Create["name"]}`>
			: {
					kind: "database"
					defaultSchema: Db["defaultSchema"]
					schemas: Extract<Db["schemas"], Record<string, SqlSchemaLike>> & {
						[K in Create["name"]]: { tables: {} }
					}
				}
		: SqlParserError<"Internal SqlApplyCreateSchema schema shape error">
