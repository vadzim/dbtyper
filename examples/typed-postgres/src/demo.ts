import { createSampleApp } from "./sample-app.ts"

const url = process.env.DATABASE_URL
if (url === undefined || url === "") {
	console.error("Set DATABASE_URL to run the demo (e.g. postgresql://user:pass@localhost:5432/dbname).")
	process.exit(1)
}

const { app, sql } = await createSampleApp(url)

try {
	const rows = await app.query("select id, name from users limit 5;")
	console.log("typed rows:", rows)
	for await (const row of app.stream("select id from users limit 5;")) {
		console.log("stream row:", row)
	}
} finally {
	await sql.end({ timeout: 5 })
}
