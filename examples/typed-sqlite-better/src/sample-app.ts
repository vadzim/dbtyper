import Database from "better-sqlite3"
import { betterSqlite3Driver } from "dbtyper/sqlite"

import { exampleDb } from "./example-schema.ts"
import { migrate } from "./migrate.ts"

/** Opens `file` (default: in memory), migrates it and returns the typed database. */
export async function createExampleApp(file = ":memory:"): Promise<{
	app: Awaited<ReturnType<typeof exampleDb>>
	sqlite: Database.Database
}> {
	const sqlite = new Database(file)
	await migrate(sqlite)
	const app = await exampleDb(betterSqlite3Driver(sqlite))
	return { app, sqlite }
}
