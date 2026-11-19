// PGT-35: every Check of capabilities/postgres.md (spec 7cb0215) is run against a real PostgreSQL through the
// `postgres` driver; the JS type of each runtime value must be one of the kinds of the TS type dbtyper infers.
// Opt-in: skipped unless DBTYPER_PG_URL is set, e.g. DBTYPER_PG_URL=postgres://postgres:pg@127.0.0.1:55432/postgres
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import postgres from "postgres"

import { sqlMigrations } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"

const url = process.env.DBTYPER_PG_URL
// `postgres()` connects lazily, so the client is safe to build when the tests are skipped.
const sql = postgres(url ?? "postgres://skipped@127.0.0.1:1/skipped", { max: 1, onnotice: () => {} })
const driver = postgresSqlDriver({ sql })

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type KindOf<T> = T extends null
	? "null"
	: T extends string
		? "string"
		: T extends number
			? "number"
			: T extends bigint
				? "bigint"
				: T extends boolean
					? "boolean"
					: T extends Date
						? "Date"
						: T extends Uint8Array
							? "Uint8Array"
							: T extends readonly (infer E)[]
								? `array<${KindOf<E>}>`
								: "object"
type Exact<Row, E> =
	Equal<
		{ [K in keyof Row]: KindOf<Row[K]> },
		{ -readonly [K in keyof E]: E[K] extends readonly (infer X)[] ? X : never }
	> extends true
		? unknown
		: {
				mismatch: "the kinds do not equal the TS type dbtyper infers"
				inferred: { [K in keyof Row]: KindOf<Row[K]> }
			}

function kindOfValue(v: unknown): string {
	if (v === null) return "null"
	if (v instanceof Date) return "Date"
	if (v instanceof Uint8Array) return "Uint8Array"
	if (Array.isArray(v)) return `array<${v.length === 0 ? "?" : kindOfValue(v[0])}>`
	return typeof v === "object" ? "object" : typeof v
}

/** Compile time: `expected` is exactly the kinds of the inferred row type. Run time: every value's kind is in its list. */
function check<Row extends object, const E extends { [K in keyof Row]: readonly string[] }>(
	rows: readonly Row[],
	expected: E & Exact<Row, E>,
) {
	assert.ok(rows.length > 0, "the check query returned no rows, so nothing was compared")
	for (const row of rows) {
		assert.deepEqual(Object.keys(row).sort(), Object.keys(expected).sort())
		for (const [key, value] of Object.entries(row)) {
			const kinds = (expected as Record<string, readonly string[]>)[key] ?? []
			assert.ok(
				kinds.includes(kindOfValue(value)),
				`column ${key}: runtime ${kindOfValue(value)}, inferred ${kinds.join(" | ")}`,
			)
		}
	}
}

describe("PGT-35 Checks of capabilities/postgres.md against a real PostgreSQL", { skip: url === undefined }, () => {
	const schema = "pgt35"
	before(async () => {
		await sql.unsafe(`drop schema if exists ${schema} cascade`)
		await sql.unsafe(`create schema ${schema}`)
		await sql.unsafe(`set search_path to ${schema}, public`)
		await sql.unsafe(
			`create table users (id bigserial primary key, name text not null, born date, created timestamptz not null default now(), balance numeric(12,2))`,
		)
		await sql.unsafe(`insert into users (name, born, balance) values ('a', '2000-01-01', 1.50), ('b', null, null)`)
	})
	after(async () => {
		await sql.unsafe(`drop schema if exists ${schema} cascade`)
		await sql.end({ timeout: 5 })
	})

	const users = sqlMigrations({ driver })
		.apply(
			`create table users (id bigserial primary key, name text not null, born date, created timestamptz not null default now(), balance numeric(12,2))`,
		)
		.database()

	it("PGT-3: select id, balance, count(*) over () as n from users", async () => {
		const rows = await users.query(`select id, balance, count(*) over () as n from users`)
		check(rows, { id: ["string"], balance: ["string", "null"], n: ["string"] })
	})

	it("PGT-6: insert into users (name) values ('a') returning id", async () => {
		const rows = await users.query(`insert into users (name) values ('a') returning id`)
		check(rows, { id: ["string"] })
	})

	it("PGT-7: select born, created from users", async () => {
		const rows = await users.query(`select born, created from users`)
		check(rows, { born: ["Date", "null"], created: ["Date"] })
	})

	it("PGT-12: arrays, one nesting level per dimension", async () => {
		await sql.unsafe(`create table t (tags text[] not null, grid integer[][] not null)`)
		await sql.unsafe(`insert into t values ('{a,b}', '{{1,2},{3,4}}')`)
		const db = sqlMigrations({ driver })
			.apply(`create table t (tags text[] not null, grid integer[][] not null)`)
			.database()
		const rows = await db.query(`select tags, grid from t`)
		check(rows, { tags: ["array<string>"], grid: ["array<array<number>>"] })
	})

	it("PGT-13: enum column is a union of its labels", async () => {
		await sql.unsafe(`create type mood as enum ('sad','ok')`)
		await sql.unsafe(`create table m (v mood not null)`)
		await sql.unsafe(`insert into m values ('sad'), ('ok')`)
		const db = sqlMigrations({ driver })
			.apply(`create type mood as enum ('sad','ok')`)
			.apply(`create table m (v mood not null)`)
			.database()
		const rows = await db.query(`select v from m`)
		expectType<typeof rows>(toBe<Array<{ v: "sad" | "ok" }>>())
		check(rows, { v: ["string"] })
		assert.deepEqual(new Set(rows.map(r => r.v)), new Set(["sad", "ok"]))
	})

	it("PGT-14: an unknown enum label is a compile error and the database rejects it too", async () => {
		const db = sqlMigrations({ driver })
			.apply(`create type mood as enum ('sad','ok')`)
			.apply(`create table m (v mood not null)`)
			.database()
		// @ts-expect-error PGT-14: 'happy' is not a value of enum mood
		const bad = db.query(`select * from m where v = 'happy'`)
		await assert.rejects(bad, /invalid input value for enum mood/)
	})

	it("PGT-16: untyped string literals are accepted against date and timestamptz columns", async () => {
		const rows = await users.query(`select * from users where created > '2026-01-01'`)
		check(rows, {
			id: ["string"],
			name: ["string"],
			born: ["Date", "null"],
			created: ["Date"],
			balance: ["string", "null"],
		})
		const inserted = await users.query(`insert into users (name, born) values ('p16', '2000-01-01') returning id`)
		check(inserted, { id: ["string"] })
	})

	it("PGT-17: select * from users where id = $1 with a string, a number and a bigint", async () => {
		const [first] = await users.query(`select id from users order by id limit 1`)
		assert.ok(first)
		for (const id of [first.id, Number(first.id), BigInt(first.id)]) {
			const rows = await users.query(`select * from users where id = $1`, [id])
			assert.equal(rows.length, 1)
		}
	})

	it("PGT-18: uuid default gen_random_uuid() and a timestamptz default, both optional in INSERT", async () => {
		await sql.unsafe(
			`create table a (id uuid primary key default gen_random_uuid(), at timestamptz default current_timestamp)`,
		)
		const db = sqlMigrations({ driver })
			.apply(
				`create table a (id uuid primary key default gen_random_uuid(), at timestamptz default current_timestamp)`,
			)
			.database()
		const rows = await db.query(`insert into a default values returning id, at`)
		check(rows, { id: ["string"], at: ["Date", "null"] })
	})

	it("PGT-24: select data->>'k' as k from t", async () => {
		await sql.unsafe(`create table j (data jsonb not null)`)
		await sql.unsafe(`insert into j values ('{"k":"v"}'), ('{}')`)
		const db = sqlMigrations({ driver }).apply(`create table j (data jsonb not null)`).database()
		const rows = await db.query(`select data->>'k' as k from j`)
		check(rows, { k: ["string", "null"] })
	})

	it("PGT-27: select count(*) as c, sum(1) as s, avg(1) as a", async () => {
		const rows = await users.query(`select count(*) as c, sum(1) as s, avg(1) as a`)
		check(rows, { c: ["string"], s: ["string", "null"], a: ["string", "null"] })
	})

	it("PGT-30: select extract(year from created) as y from users", async () => {
		const rows = await users.query(`select extract(year from created) as y from users`)
		check(rows, { y: ["string"] })
	})
})
