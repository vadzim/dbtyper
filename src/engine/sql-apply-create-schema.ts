import type { SqlCreateSchemaLike } from "../parser/sql-create-schema.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { SchemaExists } from "./sql-engine.js"

export type SqlApplyCreateSchema<Db extends SqlDatabaseLike, Create extends SqlCreateSchemaLike> =
	Db["schemas"] extends Record<string, Record<string, unknown>>
		? SchemaExists<Extract<Db["schemas"], Record<string, Record<string, unknown>>>, Create["name"]> extends true
			? Create["ifNotExists"] extends true
				? Db
				: SqlParseError<`Duplicate schema name: ${Create["name"]}`>
			: {
					readonly kind: "database"
					readonly defaultSchema: Db["defaultSchema"]
					readonly schemas: Extract<Db["schemas"], Record<string, Record<string, unknown>>> & {
						readonly [K in Create["name"]]: {}
					}
				}
		: SqlParseError<"Internal SqlApplyCreateSchema schema shape error">
