import { sqlMigrations } from "typesql"
import type { PostgresDriver } from "typesql/postgres"

export async function exampleDb(driver: PostgresDriver) {
	return sqlMigrations({ driver })
		.apply((await import("../migrations/001.do.schemas.js")).generateSql())
		.apply((await import("../migrations/002.do.users.js")).generateSql())
		.apply((await import("../migrations/003.do.agenda.js")).generateSql())
		.apply((await import("../migrations/004.do.seed_users.js")).generateSql())
		.database()
}

/** Logical schema shape after `database()` (for `DataBase<…>` in services). */
export type ExampleDbShape = Awaited<ReturnType<typeof exampleDb>>["$db"]
