import type { PostgresDriver } from "../../../src/postgres/index.ts"
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"

export const createTestDatabase = async () =>
	sqlMigrations({
		driver: createDriver<PostgresDriver>({ query: async () => [] }),
	})
		.apply((await import("./001.do.schemas.js")).generateSql())
		.apply((await import("./002.do.users.js")).generateSql())
		.apply((await import("./003.do.agenda.js")).generateSql())
		.apply((await import("./004.do.seed_users.js")).generateSql())
		.database()
