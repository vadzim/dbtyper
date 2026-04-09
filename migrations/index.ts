import { sqlDatabase } from "../src/engine/sql-statement.js"

export default sqlDatabase("public") //
	.apply(import("./20260409093300_users.js"))
	.apply(import("./20260409093400_agenda.js"))
