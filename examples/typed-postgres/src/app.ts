import { createExampleApp } from "./sample-app.ts"

const url = process.env.DATABASE_URL
if (url === undefined || url === "") {
	console.error("Set DATABASE_URL (see .env.example).")
	process.exit(1)
}

const { app, sql } = await createExampleApp(url)

try {
	const rows = await app.query("select email, display_name from auth.users;")
	console.log("users (typed rows from typesql + postgres):")
	for (const row of rows) {
		console.log(`  ${row.email}\t${row.display_name ?? ""}`)
	}
} finally {
	await sql.end({ timeout: 5 })
}
