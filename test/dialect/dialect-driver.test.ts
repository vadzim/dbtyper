// DSEL-1, DSEL-3, DSEL-4, DSEL-8, DSEL-9, DSEL-10: the dialect is declared by the driver and follows the chain.
import assert from "node:assert/strict"
import { test } from "node:test"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import type { SqlDriverParams } from "../../src/core/sql-database.ts"
import type { PostgresDriverConfig } from "../../src/postgres/postgres-sql-driver.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

// A minimal SQLite driver config (no dbtyper/sqlite package yet, that is #65).
type FakeSqliteConfig = {
	dialect: "sqlite"
	syntax: "" | "indexed-params"
	scalarTypes: { integer: number; text: string }
}

const calls: Array<{ sql: string; params?: SqlDriverParams | undefined }> = []
const sqliteDriver = createDriver<FakeSqliteConfig>({
	async query(sql, params) {
		calls.push({ sql, params })
		return []
	},
})
const pgDriver = createDriver<PostgresDriverConfig>({ query: async () => [] })

// DSEL-8: a driver config without a dialect is a compile error.
// @ts-expect-error DSEL-8: missing dialect
createDriver<{ syntax: ""; scalarTypes: {} }>({ query: async () => [] })

// DSEL-1/3/4: two chains of different dialects in one file type independently.
const sqliteDb = sqlMigrations({ driver: sqliteDriver })
	.apply("create schema public;")
	.apply("create table users (id integer not null, name text);")
	.database()
const pgDb = sqlMigrations({ driver: pgDriver })
	.apply("create schema public;")
	.apply("create table users (id integer not null, name text);")
	.database()

test("DSEL-3/DSEL-4: the same select is typed in both dialects", async () => {
	const _a = await sqliteDb.query("select 1 as x")
	const _b = await pgDb.query("select 1 as x")
	expectType<typeof _a>(toBe<Array<{ x: number }>>())
	expectType<typeof _b>(toBe<Array<{ x: number }>>())
	const _c = await sqliteDb.stream("select id from users")
	expectType<typeof _c>(toBe<AsyncIterable<{ id: number }>>())
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
