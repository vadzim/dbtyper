import { sqlDatabase } from "../src/engine/sql-database.ts"

export const appDB = await sqlDatabase("public")
	.apply(import("./20260409093100_auth_schema.ts"))
	.apply(import("./20260409093200_public_schema.ts"))
	.apply(import("./20260409093300_users.ts"))
	.apply(import("./20260409093400_agenda.ts"))
	.compile()

// const wiredDB = appDB.connect({
// 	async query(sql: string) {
// 		return []
// 	},
// 	async *stream(sql: string) {},
// })

// const agenda = await wiredDB.query("select * from agenda")
// const users = wiredDB.stream("select id, email, created_at from auth.users")
