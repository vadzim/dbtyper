import { migrations } from "../src/migrations/migrations.js"

export default migrations() //
	.apply(import("./20260409093300_users.js"))
	.apply(import("./20260409093400_agenda.js"))
