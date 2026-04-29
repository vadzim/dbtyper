import postgres from "postgres"
import { compileExampleDb } from "./example-schema.ts"
import { postgresSqlDriver } from "./postgres-driver.ts"

/** Wired DB matching {@link compileExampleDb} migrations + postgres driver. */
export async function createExampleApp(connectionString: string) {
	const logicalDb = await compileExampleDb()
	const sql = postgres(connectionString, { max: 10 })
	const app = logicalDb.connect(postgresSqlDriver(sql))
	return { app, sql }
}
