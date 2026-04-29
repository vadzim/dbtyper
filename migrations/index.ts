import { sqlMigrations } from "../src/engine/sql-database.ts"
import type { PostgresTypeMap } from "../src/postgres/postgres-type-map.ts"

export const appDB = sqlMigrations({
	driver: {
		query: async () => [],
		async *stream() {},
		scalarTypes: {} as PostgresTypeMap,
	},
})
	.apply((await import("./20260409093100.do.auth_schema.js")).generateSql())
	.apply((await import("./20260409093200.do.public_schema.js")).generateSql())
	.apply((await import("./20260409093300.do.users.js")).generateSql())
	.apply((await import("./20260409093400.do.agenda.js")).generateSql())
	.database()

// const wiredDB = appDB.database()

// const agenda = await wiredDB.query("select * from agenda")
// const users = wiredDB.stream("select id, email, created_at from auth.users")
