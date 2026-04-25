import { sqlDatabase } from "../src/engine/sql-database.ts"

export const appDB = await sqlDatabase("public")
	.apply(import("./20260409093100_auth_schema.ts"))
	.apply(import("./20260409093200_public_schema.ts"))
	.apply(import("./20260409093300_users.ts"))
	.apply(import("./20260409093400_agenda.ts"))
	.compile()

// const agenda = await appDB.query("select * from agenda")
// const users = await appDB.query("select id, email, created_at from auth.users")
