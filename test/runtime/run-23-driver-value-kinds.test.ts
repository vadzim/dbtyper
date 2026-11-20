// RUN-23: the JS kind of each value matches its inferred type. SQLite (in-process, both drivers) always runs;
// PostgreSQL (real, TEST-6) runs when DBTYPER_PG_URL is set, e.g. DBTYPER_PG_URL=postgres://postgres:pg@127.0.0.1:55432/postgres
// (#169, #153 are about NUMERIC in bigint mode and PostgreSQL numerics: not asserted here, the Check does not use them.)
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { DatabaseSync } from "node:sqlite"
import { after, describe, it } from "node:test"
import postgres from "postgres"

import { sqlMigrations } from "../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"
import { betterSqlite3Driver, nodeSqliteDriver } from "../../src/sqlite/index.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const require = createRequire(import.meta.url)
const BetterSqlite3 = require("better-sqlite3") as new (path: string) => {
	prepare(sql: string): unknown
	exec(sql: string): void
}

const usersSql = `create table users (id integer not null, name text not null)`
const rowSql = `insert into users (id, name) values (7, 'ann')`

function better() {
	const h = new BetterSqlite3(":memory:")
	h.exec(`${usersSql}; ${rowSql}`)
	return h
}
function nodeSqlite() {
	const h = new DatabaseSync(":memory:")
	h.exec(`${usersSql}; ${rowSql}`)
	return h
}

describe("RUN-23 SQLite: { bigint: true } types id as bigint at runtime too", () => {
	it("RUN-23 betterSqlite3Driver: without bigint { id: number } and typeof number; with it { id: bigint } and bigint", async () => {
		const plain = await sqlMigrations({ driver: betterSqlite3Driver(better()) })
			.apply(usersSql)
			.database()
			.query(`select id from users`)
		expectType<typeof plain>(toBe<{ id: number }[]>())
		assert.equal(typeof plain[0]!.id, "number")
		const big = await sqlMigrations({ driver: betterSqlite3Driver(better(), { bigint: true }) })
			.apply(usersSql)
			.database()
			.query(`select id from users`)
		expectType<typeof big>(toBe<{ id: bigint }[]>())
		assert.equal(typeof big[0]!.id, "bigint")
	})
	it("RUN-23 nodeSqliteDriver: without bigint { id: number } and typeof number; with it { id: bigint } and bigint", async () => {
		const plain = await sqlMigrations({ driver: nodeSqliteDriver(nodeSqlite()) })
			.apply(usersSql)
			.database()
			.query(`select id from users`)
		expectType<typeof plain>(toBe<{ id: number }[]>())
		assert.equal(typeof plain[0]!.id, "number")
		const big = await sqlMigrations({ driver: nodeSqliteDriver(nodeSqlite(), { bigint: true }) })
			.apply(usersSql)
			.database()
			.query(`select id from users`)
		expectType<typeof big>(toBe<{ id: bigint }[]>())
		assert.equal(typeof big[0]!.id, "bigint")
	})
})

const url = process.env.DBTYPER_PG_URL
describe("RUN-23 PostgreSQL (real)", { skip: url === undefined }, () => {
	const sql = postgres(url ?? "postgres://skipped@127.0.0.1:1/skipped", { max: 1, onnotice: () => {} })
	const schema = `create table run23_v (a bigint not null, b integer not null, c text not null, d timestamptz not null);`
	it("RUN-23: { a: string; b: number; c: string; d: Date }, kinds at runtime; bigint: true gives a bigint", async () => {
		try {
			await sql.unsafe(`drop table if exists run23_v`)
			await sql.unsafe(schema)
			await sql.unsafe(`insert into run23_v values (9007199254740993, 5, 'x', now())`)
			const db = sqlMigrations({ driver: postgresSqlDriver({ sql }) })
				.apply(schema)
				.database()
			const rows = await db.query(`select a, b, c, d from run23_v`)
			expectType<typeof rows>(toBe<{ a: string; b: number; c: string; d: Date }[]>())
			const row = rows[0]!
			assert.equal(typeof row.a, "string")
			assert.equal(typeof row.b, "number")
			assert.equal(typeof row.c, "string")
			assert.ok(row.d instanceof Date)
			const big = sqlMigrations({ driver: postgresSqlDriver({ sql, bigint: true }) })
				.apply(schema)
				.database()
			const bigRows = await big.query(`select a from run23_v`)
			expectType<typeof bigRows>(toBe<{ a: bigint }[]>())
			assert.equal(typeof bigRows[0]!.a, "bigint")
		} finally {
			await sql.unsafe(`drop table if exists run23_v`).catch(() => {})
		}
	})
	// RUN-16 (real PostgreSQL half): `limit 5` over 7 rows yields exactly 5 rows typed { email: string }
	it("RUN-16: stream of `select email from auth.users limit 5` yields exactly 5 rows when the table holds more", async () => {
		const create = `create schema if not exists run16; create table run16.users (email text not null);`
		try {
			await sql.unsafe(`drop schema if exists run16 cascade`)
			await sql.unsafe(create)
			await sql.unsafe(`insert into run16.users select 'u' || g || '@x' from generate_series(1, 7) g`)
			const db = sqlMigrations({ driver: postgresSqlDriver({ sql }) })
				.apply(`create schema run16;`)
				.apply(`create table run16.users (email text not null);`)
				.database()
			const rows = await Array.fromAsync(await db.stream(`select email from run16.users order by email limit 5;`))
			expectType<typeof rows>(toBe<{ email: string }[]>())
			assert.equal(rows.length, 5)
			assert.equal(typeof rows[0]!.email, "string")
		} finally {
			await sql.unsafe(`drop schema if exists run16 cascade`).catch(() => {})
		}
	})
	after(async () => {
		await sql.end({ timeout: 5 })
	})
})
