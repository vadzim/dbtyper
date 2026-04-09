import { migrations } from "../src/migrations/migrations.js"

export default migrations(
	import("./20260409093300_users.js"),
	import("./20260409093400_agenda.js"),
	//
)
