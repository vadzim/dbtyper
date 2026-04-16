import type { CreateSchemaStatement } from "../parser/parse-create-schema.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike } from "./sql-database.ts"
import type { SchemaExists } from "./helpers/engine-helpers.ts"

export type ApplyCreateSchema<Db extends SqlDatabaseLike, Create extends CreateSchemaStatement> =
	Db["schemas"] extends Record<string, Record<string, unknown>>
		? SchemaExists<Extract<Db["schemas"], Record<string, Record<string, unknown>>>, Create["name"]> extends true
			? Create["ifNotExists"] extends true
				? Db
				: SqlParserError<`Duplicate schema name: ${Create["name"]}`>
			: {
					kind: "database"
					defaultSchema: Db["defaultSchema"]
					schemas: Extract<Db["schemas"], Record<string, Record<string, unknown>>> & {
						[K in Create["name"]]: {}
					}
				}
		: SqlParserError<"Internal SqlApplyCreateSchema schema shape error">
