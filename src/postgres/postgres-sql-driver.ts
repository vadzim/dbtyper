import type postgres from "postgres"

import { createDriver, type SqlDriver, type SqlDriverParams } from "../core/sql-database.ts"
import { STREAM_REQUIRES_ROWS_MESSAGE } from "../core/stream-requires-rows.ts"
import { POSTGRES_SCAN_RULES, skipNonCode } from "../core/sql-text-scanner.ts"
import { bindColonNamedParamsForPg } from "./bind-colon-named-params-for-pg.ts"
import type { PostgresParamTypeMap, PostgresTypeMap } from "./postgres-type-map.ts"

export type PostgresDriverConfig<Bigint extends boolean = false> = {
	dialect: "postgres"
	scalarTypes: PostgresTypeMap<Bigint>
	paramTypes: PostgresParamTypeMap<Bigint>
	syntax: "named-params" | "indexed-params"
}

export type PostgresSqlDriverConfig = {
	/** Connected **`postgres()`** client from the **`postgres`** package. */
	sql: ReturnType<typeof postgres>
	/**
	 * Server-side cursor batch size for **`stream`** (`postgres` **`cursor`**).
	 * @default 50
	 */
	pageSize?: number
	/**
	 * PGT-4: type-level switch for `int8` → `bigint`. Set it only when your `postgres` client parses int8 to BigInt
	 * (dbtyper never changes the client's parsers, PGT-3).
	 * @default false
	 */
	bigint?: boolean
}

/** The highest `$n` the text reads outside strings, quoted names, comments and dollar bodies (0: none). */
function highestDollarParam(sql: string): number {
	let max = 0
	let i = 0
	while (i < sql.length) {
		const skipTo = skipNonCode(sql, i, POSTGRES_SCAN_RULES)
		if (skipTo > i) {
			i = skipTo
		} else if (sql[i] === "$" && /[0-9]/.test(sql[i + 1] ?? "")) {
			let j = i + 1
			while (/[0-9]/.test(sql[j] ?? "")) j++
			max = Math.max(max, Number(sql.slice(i + 1, j)))
			i = j
		} else {
			i++
		}
	}
	return max
}

/** PARAM-14 (#170): PostgreSQL rejects a Bind with more values than the text reads, so a surplus value is left out. */
function pgQueryArgs(text: string, params?: SqlDriverParams): { text: string; values: readonly unknown[] } {
	if (params === undefined) {
		return { text, values: [] }
	}
	if (Array.isArray(params)) {
		// PARAM-15: parameters are `$n` only; `?`, `?|`, `?&` are jsonb operators and are sent unchanged.
		return { text, values: params.slice(0, highestDollarParam(text)) }
	}
	return bindColonNamedParamsForPg(text, params as Record<string, unknown>)
}

function createConnectedPostgresDriver(
	sql: ReturnType<typeof postgres>,
	pageSize: number,
): SqlDriver<PostgresDriverConfig> {
	return createDriver<PostgresDriverConfig>({
		defaultSchema: "public",
		async query(text: string, params?: SqlDriverParams) {
			const { text: sqlText, values } = pgQueryArgs(text, params)
			const rows = values.length > 0 ? await sql.unsafe(sqlText, [...values] as never) : await sql.unsafe(sqlText)
			return [...rows] as unknown[]
		},

		async stream(text: string, params?: SqlDriverParams): Promise<AsyncIterable<unknown>> {
			const { text: sqlText, values } = pgQueryArgs(text, params)
			const pending = () => (values.length > 0 ? sql.unsafe(sqlText, [...values] as never) : sql.unsafe(sqlText))
			// RUN-12: a statement without result columns cannot be streamed (the cursor would just end without rows).
			if ((await pending().describe()).columns.length === 0) {
				throw new Error(STREAM_REQUIRES_ROWS_MESSAGE)
			}

			return (async function* () {
				// Use postgres.js cursor for true streaming with server-side cursor
				const cursor = pending().cursor(pageSize)

				for await (const rows of cursor) {
					for (const row of rows) {
						yield row
					}
				}
			})()
		},
	})
}

/**
 * Adapts [postgres](https://github.com/porsager/postgres) to dbtyper’s {@link SqlDriver}.
 * Uses `unsafe` for dynamic SQL strings; only pass strings you already validated at compile time
 * via dbtyper (or trusted literals).
 *
 * Accepts positional parameter arrays or `:name` maps; `:name` tokens are rewritten to `$1`, `$2`, … (skipping
 * PostgreSQL `::` casts and `:name` inside single-quoted literals).
 */
export function postgresSqlDriver(
	config: PostgresSqlDriverConfig & { bigint: true },
): SqlDriver<PostgresDriverConfig<true>>
export function postgresSqlDriver(config: PostgresSqlDriverConfig): SqlDriver<PostgresDriverConfig>
export function postgresSqlDriver(
	config: PostgresSqlDriverConfig,
): SqlDriver<PostgresDriverConfig> | SqlDriver<PostgresDriverConfig<true>> {
	const pageSize = config.pageSize ?? 50
	return createConnectedPostgresDriver(config.sql, pageSize)
}
