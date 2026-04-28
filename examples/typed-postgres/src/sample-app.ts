import postgres from "postgres"
import { sqlDatabase } from "typesql"
import { postgresSqlDriver } from "./postgres-driver.ts"

/**
 * Builds a logical schema with typesql (same SQL you ship as migrations), wires a real Postgres
 * client, and returns a connection whose `query` / `stream` methods infer row types from that schema.
 */
export async function createSampleApp(connectionString: string) {
	const logicalDb = await sqlDatabase("public")
		.apply(`create table users ( id uuid not null, name text not null );`)
		.compile()

	const sql = postgres(connectionString, { max: 10 })
	const app = logicalDb.connect(postgresSqlDriver(sql))

	return { app, sql }
}

/** Example: all rows typed from the logical schema + query text. */
export async function loadUserNames(connectionString: string) {
	const { app, sql } = await createSampleApp(connectionString)
	try {
		const rows = await app.query("select name from users;")
		return rows.map(r => r.name)
	} finally {
		await sql.end({ timeout: 5 })
	}
}

/** Example: async iteration over rows (postgres.js cursor under the hood). */
export async function iterateUserIds(connectionString: string) {
	const { app, sql } = await createSampleApp(connectionString)
	try {
		const ids: string[] = []
		for await (const row of app.stream("select id from users;")) {
			ids.push(String(row.id))
		}
		return ids
	} finally {
		await sql.end({ timeout: 5 })
	}
}
