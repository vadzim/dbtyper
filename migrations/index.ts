import { sqlDatabase } from "../src/engine/sql-database.js"

export default sqlDatabase("public") //
	.apply(import("./20260409093100_auth_schema.js"))
	.apply(import("./20260409093200_public_schema.js"))
	.apply(import("./20260409093300_users.js"))
	.apply(import("./20260409093400_agenda.js"))
