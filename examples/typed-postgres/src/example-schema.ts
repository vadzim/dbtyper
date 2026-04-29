import { sqlDatabase } from "typesql"
import type { PostgresDriver } from "typesql/postgres"

export async function compileExampleDb(driver: PostgresDriver) {
	return sqlDatabase({ driver })
		.apply((await import("../migrations/001.do.schemas.js")).generateSql())
		.apply((await import("../migrations/002.do.users.js")).generateSql())
		.apply((await import("../migrations/003.do.agenda.js")).generateSql())
		.apply((await import("../migrations/004.do.seed_users.js")).generateSql())
		.database()
}
