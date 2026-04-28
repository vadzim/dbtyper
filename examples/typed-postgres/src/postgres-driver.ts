import postgres from "postgres"
import type { SqlDriver } from "typesql"

/**
 * Adapts [postgres](https://github.com/porsager/postgres) to typesql’s {@link SqlDriver}.
 * Uses `unsafe` for dynamic SQL strings; only pass strings you already validated at compile time
 * via typesql (or trusted literals).
 */
export function postgresSqlDriver(sql: ReturnType<typeof postgres>): SqlDriver {
	return {
		async query(text: string) {
			const rows = await sql.unsafe(text)
			return [...rows] as unknown[]
		},
		stream(text: string): AsyncIterable<unknown> {
			const pending = sql.unsafe(text)
			return (async function* () {
				for await (const batch of pending.cursor(50)) {
					for (const row of batch) {
						yield row
					}
				}
			})()
		},
	}
}
