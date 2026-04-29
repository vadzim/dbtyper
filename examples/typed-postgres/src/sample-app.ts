import postgres from "postgres"
import { postgresSqlDriver } from "typesql/postgres"

import { compileExampleDb } from "./example-schema.ts"

/** Wired DB matching {@link compileExampleDb} migrations + postgres driver. */
export async function createExampleApp(connectionString: string) {
	const sql = postgres(connectionString, { max: 10 })
	const logicalDb = await compileExampleDb(postgresSqlDriver({ sql }))
	const app = logicalDb.connect()
	return { app, sql }
}
