import { sqlDatabase } from "../src/engine/sql-database.ts"

export default sqlDatabase("public") //
	.apply(import("./20260409093100_auth_schema.ts"))
	.apply(import("./20260409093200_public_schema.ts"))
	.apply(import("./20260409093300_users.ts"))
	.apply(import("./20260409093400_agenda.ts"))
