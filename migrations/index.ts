import { sqlDatabase } from "../src/engine/sql-database.ts"
import type { PostgresTypeMap } from "../src/postgres/postgres-type-map.ts"

export const appDB = await sqlDatabase({
	driver: {
		query: async () => [],
		async *stream() {},
		scalarTypes: {} as PostgresTypeMap,
	},
})
	.apply(import("./20260409093100_auth_schema.ts"))
	.apply(import("./20260409093200_public_schema.ts"))
	.apply(import("./20260409093300_users.ts"))
	.apply(import("./20260409093400_agenda.ts"))
	.compile()

// const wiredDB = appDB.connect()

// const agenda = await wiredDB.query("select * from agenda")
// const users = wiredDB.stream("select id, email, created_at from auth.users")
