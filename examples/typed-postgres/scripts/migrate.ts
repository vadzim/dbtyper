import Postgrator from "postgrator"
import postgres from "postgres"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === "") {
	console.error("Set DATABASE_URL (see .env.example).")
	process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1 })
try {
	const here = dirname(fileURLToPath(import.meta.url))
	const dbName = new URL(databaseUrl).pathname.replace(/^\//, "")
	const postgrator = new Postgrator({
		migrationPattern: join(here, "../migrations/*.do.*.js"),
		driver: "pg",
		database: dbName,
		execQuery: async query => {
			const rows = await sql.unsafe(query)
			return { rows: [...rows] as unknown[] }
		},
	})
	await postgrator.migrate()
	console.log("migrations applied OK")
} finally {
	await sql.end({ timeout: 5 })
}
