import postgres from "postgres"

import type { SqlDriver, SqlDriverParams } from "../engine/sql-database.ts"
import type { PostgresTypeMap } from "../parser/postgres-type-map.ts"
import { bindColonNamedParamsForPg } from "./bind-colon-named-params-for-pg.ts"

/** Implements {@link SqlDriver} for PostgreSQL and carries {@link PostgresTypeMap} for {@link sqlDatabase} inference. */
export type PostgresDriver = SqlDriver & {
	readonly typesqlScalarTypes: PostgresTypeMap
}

/** Runtime marker only — satisfies {@link PostgresDriver.typesqlScalarTypes}; not read by typesql. */
const postgresScalarTypesMarker = {} as PostgresTypeMap

function pgQueryArgs(text: string, params?: SqlDriverParams): { text: string; values: readonly unknown[] } {
	if (params === undefined) {
		return { text, values: [] }
	}
	if (Array.isArray(params)) {
		return { text, values: params }
	}
	return bindColonNamedParamsForPg(text, params as Record<string, unknown>)
}

const noopPostgresDriverImpl: SqlDriver = {
	async query() {
		return []
	},
	async *stream() {},
}

function createConnectedPostgresDriver(sql: ReturnType<typeof postgres>): SqlDriver {
	return {
		async query(text: string, params?: SqlDriverParams) {
			const { text: sqlText, values } = pgQueryArgs(text, params)
			const rows = values.length > 0 ? await sql.unsafe(sqlText, [...values] as never) : await sql.unsafe(sqlText)
			return [...rows] as unknown[]
		},
		stream(text: string, params?: SqlDriverParams): AsyncIterable<unknown> {
			const { text: sqlText, values } = pgQueryArgs(text, params)
			const pending = values.length > 0 ? sql.unsafe(sqlText, [...values] as never) : sql.unsafe(sqlText)
			return (async function* () {
				for await (const batch of pending.cursor(50)) {
					yield* batch
				}
			})()
		},
	}
}

/**
 * Adapts [postgres](https://github.com/porsager/postgres) to typesql’s {@link SqlDriver}.
 * Uses `unsafe` for dynamic SQL strings; only pass strings you already validated at compile time
 * via typesql (or trusted literals).
 *
 * Accepts positional parameter arrays or `:name` maps; `:name` tokens are rewritten to `$1`, `$2`, … (skipping
 * PostgreSQL `::` casts and `:name` inside single-quoted literals).
 *
 * With **no argument**, returns a minimal driver (empty `query` / `stream`) suitable only for
 * `sqlDatabase({ driver: postgresSqlDriver() }).apply(…).compile()` — use the overload with a real `sql`
 * client for runtime queries.
 */
export function postgresSqlDriver(sql: ReturnType<typeof postgres>): PostgresDriver
export function postgresSqlDriver(): PostgresDriver
export function postgresSqlDriver(sql?: ReturnType<typeof postgres>): PostgresDriver {
	const base = sql === undefined ? noopPostgresDriverImpl : createConnectedPostgresDriver(sql)
	return Object.assign(base, { typesqlScalarTypes: postgresScalarTypesMarker })
}
