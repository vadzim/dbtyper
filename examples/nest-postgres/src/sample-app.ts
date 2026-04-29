import postgres from "postgres"
import { postgresSqlDriver } from "typesql/postgres"

import { exampleDb } from "./example-schema.ts"

/** Wired DB matching {@link exampleDb} migrations + postgres driver. */
export async function createExampleApp(connectionString: string) {
	const sql = postgres(connectionString, { max: 10 })
	const logicalDb = await exampleDb(postgresSqlDriver({ sql }))
	const app = logicalDb
	return { app, sql }
}
