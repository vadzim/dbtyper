import { sqlDatabase } from "../src/engine/sql-database.ts"
import { postgresSqlDriver } from "../src/postgres/postgres-sql-driver.ts"

export const appDB = await sqlDatabase({ driver: postgresSqlDriver() })
	.apply(import("./20260409093100_auth_schema.ts"))
	.apply(import("./20260409093200_public_schema.ts"))
	.apply(import("./20260409093300_users.ts"))
	.apply(import("./20260409093400_agenda.ts"))
	.compile()

// const wiredDB = appDB.connect()

// const agenda = await wiredDB.query("select * from agenda")
// const users = wiredDB.stream("select id, email, created_at from auth.users")
