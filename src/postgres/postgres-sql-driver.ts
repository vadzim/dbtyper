import postgres from "postgres"

import type { SqlDriverParams } from "../engine/sql-database.ts"
import { postgresDriverScalarTypesBrand, type PostgresDriver } from "./postgres-driver.ts"
import { bindColonNamedParamsForPg } from "./bind-colon-named-params-for-pg.ts"

export type PostgresSqlDriverConfig = {
	/** Connected **`postgres()`** client from the **`postgres`** package. */
	sql: ReturnType<typeof postgres>
	/**
	 * Server-side cursor batch size for **`stream`** (`postgres` **`cursor`**).
	 * @default 50
	 */
	pageSize?: number
}

function pgQueryArgs(text: string, params?: SqlDriverParams): { text: string; values: readonly unknown[] } {
	if (params === undefined) {
		return { text, values: [] }
	}
	if (Array.isArray(params)) {
		return { text, values: params }
	}
	return bindColonNamedParamsForPg(text, params as Record<string, unknown>)
}

function createConnectedPostgresDriver(sql: ReturnType<typeof postgres>, pageSize: number): PostgresDriver {
	return {
		async query(text: string, params?: SqlDriverParams) {
			const { text: sqlText, values } = pgQueryArgs(text, params)
			const rows = values.length > 0 ? await sql.unsafe(sqlText, [...values] as never) : await sql.unsafe(sqlText)
			return [...rows] as unknown[]
		},
		async *stream(text: string, params?: SqlDriverParams): AsyncIterable<unknown> {
			const { text: sqlText, values } = pgQueryArgs(text, params)
			const pending = values.length > 0 ? sql.unsafe(sqlText, [...values] as never) : sql.unsafe(sqlText)
			for await (const batch of pending.cursor(pageSize)) {
				yield* batch
			}
		},
		scalarTypes: postgresDriverScalarTypesBrand,
	}
}

/**
 * Adapts [postgres](https://github.com/porsager/postgres) to typesql’s {@link SqlDriver}.
 * Uses `unsafe` for dynamic SQL strings; only pass strings you already validated at compile time
 * via typesql (or trusted literals).
 *
 * Accepts positional parameter arrays or `:name` maps; `:name` tokens are rewritten to `$1`, `$2`, … (skipping
 * PostgreSQL `::` casts and `:name` inside single-quoted literals).
 */
export function postgresSqlDriver(config: PostgresSqlDriverConfig): PostgresDriver {
	const pageSize = config.pageSize ?? 50
	return createConnectedPostgresDriver(config.sql, pageSize)
}
