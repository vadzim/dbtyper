import { sqlMigrations, type SqlDriver } from "dbtyper"
import type { SqliteDriver } from "dbtyper/sqlite"

/** The migration modules, in order. The same modules feed the type chain below and the runtime runner in migrate.ts. */
export const migrationModules = [
	() => import("../migrations/001.do.users.js"),
	() => import("../migrations/002.do.posts.js"),
] as const

export async function exampleDb(driver: SqlDriver<SqliteDriver>) {
	return sqlMigrations({ driver })
		.apply((await import("../migrations/001.do.users.js")).generateSql())
		.apply((await import("../migrations/002.do.posts.js")).generateSql())
		.database()
}
