// DSEL-1, DSEL-3, DSEL-4, DSEL-8, DSEL-9, DSEL-10: the dialect is declared by the driver and follows the chain.
import assert from "node:assert/strict"
import { test } from "node:test"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import { betterSqlite3Driver, nodeSqliteDriver } from "../../src/sqlite/index.ts"
import type { SqlDriverParams } from "../../src/core/sql-database.ts"
import type { PostgresDriverConfig } from "../../src/postgres/postgres-sql-driver.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const calls: Array<{ sql: string; params?: SqlDriverParams | undefined }> = []
const fakeDb = {
	prepare(sql: string) {
		calls.push({ sql })
		return {
			reader: true,
			all: () => [],
			iterate: () => [],
			run: () => {},
			safeIntegers: () => {},
			setReadBigInts: () => {},
		}
	},
}
const sqliteDriver = betterSqlite3Driver(fakeDb)
const pgDriver = createDriver<PostgresDriverConfig>({ query: async () => [] })

// DSEL-8: a driver config without a dialect is a compile error.
// @ts-expect-error DSEL-8: missing dialect
createDriver<{ syntax: ""; scalarTypes: {} }>({ query: async () => [] })

// DSEL-1/3/4: two chains of different dialects in one file type independently.
// SQLT-25: a SQLite chain creates a table with no `create schema` (PostgreSQL-only, DSEL-5).
const sqliteDb = sqlMigrations({ driver: sqliteDriver })
	.apply("create table users (id integer not null, name text);")
	.database()
const nodeDb = sqlMigrations({ driver: nodeSqliteDriver(fakeDb) }).database()
const pgDb = sqlMigrations({ driver: pgDriver })
	.apply("create schema public;")
	.apply("create table users (id integer not null, name text);")
	.database()

test("DSEL-3/DSEL-4: the same select is typed in both dialects", async () => {
	const _a = await sqliteDb.query("select 1 as x")
	const _b = await pgDb.query("select 1 as x")
	expectType<typeof _a>(toBe<Array<{ x: number }>>())
	expectType<typeof _b>(toBe<Array<{ x: number }>>())
	const _c = await sqliteDb.stream("select 1 as id")
	expectType<typeof _c>(toBe<AsyncIterable<{ id: number }>>())
	const _d = await nodeDb.query("select 1 as x")
	expectType<typeof _d>(toBe<Array<{ x: number }>>())
	const _e = await sqliteDb.query("select id, name from users")
	expectType<typeof _e>(toBe<Array<{ id: number; name: string | null }>>())
	void sqliteDb.query("select ?1 as p", [1])
	// @ts-expect-error DSEL-4: `?1` is SQLite-only, the PostgreSQL chain rejects it
	void pgDb.query("select ?1 as p", [1])
})

test("DSEL-9/DSEL-10: untyped calls never check syntax and the SQL text reaches the driver unchanged", async () => {
	calls.length = 0
	const text = "select  `weird` ::text   from nowhere -- not checked"
	await sqliteDb.queryUntyped(text)
	const rows = await sqliteDb.streamUntyped(text)
	for await (const _ of rows) {
		// empty
	}
	assert.deepEqual(
		calls.map(call => call.sql),
		[text, text],
	)
})
