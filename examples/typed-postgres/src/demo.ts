import { createExampleApp } from "./sample-app.ts"

const url = process.env.DATABASE_URL
if (url === undefined || url === "") {
	console.error("Set DATABASE_URL to run the demo (see .env.example).")
	process.exit(1)
}

const { app, sql } = await createExampleApp(url)

try {
	const rows = await app.query(
		"select email, display_name, login_count, created_at from auth.users order by email asc;",
	)
	console.log("typed rows:", rows)
	for await (const row of app.stream("select email from auth.users limit 5;")) {
		console.log("stream row:", row)
	}
} finally {
	await sql.end({ timeout: 5 })
}
