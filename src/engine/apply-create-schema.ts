import type { SqlCreateSchema } from "../parser/sql-create-schema.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { SchemaExists } from "./helpers/engine-helpers.js"

export type ApplyCreateSchema<Db extends SqlDatabaseLike, Create extends SqlCreateSchema> =
	Db["schemas"] extends Record<string, Record<string, unknown>>
		? SchemaExists<Extract<Db["schemas"], Record<string, Record<string, unknown>>>, Create["name"]> extends true
			? Create["ifNotExists"] extends true
				? Db
				: SqlParserError<`Duplicate schema name: ${Create["name"]}`>
			: {
					readonly kind: "database"
					readonly defaultSchema: Db["defaultSchema"]
					readonly schemas: Extract<Db["schemas"], Record<string, Record<string, unknown>>> & {
						readonly [K in Create["name"]]: {}
					}
				}
		: SqlParserError<"Internal SqlApplyCreateSchema schema shape error">
