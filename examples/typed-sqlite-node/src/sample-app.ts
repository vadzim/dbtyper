import { DatabaseSync } from "node:sqlite"
import { nodeSqliteDriver } from "dbtyper/sqlite"

import { exampleDb } from "./example-schema.ts"
import { migrate } from "./migrate.ts"

/** Opens `file` (default: in memory), migrates it and returns the typed database. */
export async function createExampleApp(file = ":memory:") {
	const sqlite = new DatabaseSync(file)
	await migrate(sqlite)
	const app = await exampleDb(nodeSqliteDriver(sqlite))
	return { app, sqlite }
}
