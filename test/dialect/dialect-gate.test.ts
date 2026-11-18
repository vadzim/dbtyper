// DSEL-4, DSEL-5, DSEL-6, DSEL-7, DSEL-11: the grammar gate and the other-dialect errors (#97).
import assert from "node:assert/strict"
import { test } from "node:test"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import type { GetApplyError, GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import type { PostgresDriverConfig } from "../../src/postgres/postgres-sql-driver.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

// The SQLite chain has no tables: SQLite schema typing (no `create schema`, default schema) is #68…#77. The scalar
// map is the small one of dialect-driver.test.ts, the real SqliteTypeMap is not wired into the shared typer yet.
type FakeSqliteConfig = { dialect: "sqlite"; syntax: "question-params"; scalarTypes: { integer: number; text: string } }
const sqliteDriver = createDriver<FakeSqliteConfig>({ query: async () => [] })
const pgDriver = createDriver<PostgresDriverConfig>({ query: async () => [] })

const sqliteMigrations = sqlMigrations({ driver: sqliteDriver })
const pgMigrations = sqlMigrations({ driver: pgDriver })
	.apply("create schema public;")
	.apply("create table users (id integer not null, name text);")
	.apply("create table orders (id integer not null, user_id integer not null);")
const sqliteDb = sqliteMigrations.database()
const pgDb = pgMigrations.database()

type NotOtherDialect<E> = E extends DbtyperError<1900 | 1901, string> ? false : true

test("DSEL-11: the same SQL is typed identically in both dialects", async () => {
	const a1 = await sqliteDb.query("select 1 as x")
	const b1 = await pgDb.query("select 1 as x")
	expectType<typeof a1>(toBe<Array<{ x: number }>>())
	expectType<typeof b1>(toBe<Array<{ x: number }>>())
	// a join and a where, over derived tables (the SQLite chain has no tables yet)
	const join = "select a.x, b.y from (select 1 as x) a join (select 2 as y) b on a.x = b.y where a.x > 0"
	const a2 = await sqliteDb.query(join)
	const b2 = await pgDb.query(join)
	expectType<typeof a2>(toBe<Array<{ x: number; y: number }>>())
	expectType<typeof b2>(toBe<Array<{ x: number; y: number }>>())
	// and over a real table where the chain has one
	const b3 = await pgDb.query(
		"select u.id, o.id as order_id from users u join orders o on o.user_id = u.id where u.id > 1",
	)
	expectType<typeof b3>(toBe<Array<{ id: number; order_id: number }>>())
	assert.ok(true)
})

test("DSEL-4: select ?1 is accepted by SQLite and rejected as SQLite-only by PostgreSQL", async () => {
	const rows = await sqliteDb.query("select ?1 as p", [1])
	expectType<typeof rows>(toBe<Array<{ p: unknown }>>())
	type PgError = GetQueryError<typeof pgDb, "select ?1", [1]>
	expectType<PgError>(
		toBe<DbtyperError<1901, "`?NNN` parameter is SQLite-only; this database is PostgreSQL. Use $1, $2, …">>(),
	)
	type SqliteError = GetQueryError<typeof sqliteDb, "select ?1 as p", [1]>
	expectType<SqliteError>(toBe<null>())
})

test("DSEL-5/DSEL-7: PostgreSQL-only syntax in a SQLite chain is error 1900", () => {
	type Cast = GetQueryError<typeof sqliteDb, "select 1::text as t">
	expectType<Cast>(
		toBe<DbtyperError<1900, "`::` cast is PostgreSQL-only; this database is SQLite. Use CAST(x AS TEXT)">>(),
	)
	type CastMigration = GetApplyError<typeof sqliteMigrations, "create table t (a integer default 1::integer);">
	expectType<CastMigration>(
		toBe<DbtyperError<1900, "`::` cast is PostgreSQL-only; this database is SQLite. Use CAST(x AS TEXT)">>(),
	)
	type Ilike = GetQueryError<typeof sqliteDb, "select 1 as x where 'a' ilike 'A'">
	expectType<Ilike extends DbtyperError<1900, string> ? true : false>(toBe<true>())
	type Schema = GetApplyError<typeof sqliteMigrations, "create schema s;">
	expectType<Schema extends DbtyperError<1900, string> ? true : false>(toBe<true>())
})

test("DSEL-6/DSEL-7: SQLite-only syntax in a PostgreSQL chain is error 1901", () => {
	type Replace = GetQueryError<typeof pgDb, "insert or replace into users (id) values (1)">
	expectType<Replace>(
		toBe<
			DbtyperError<
				1901,
				"INSERT OR REPLACE is SQLite-only; this database is PostgreSQL. Use ON CONFLICT … DO UPDATE"
			>
		>(),
	)
	type Backtick = GetQueryError<typeof pgDb, "select `name` from users">
	expectType<Backtick>(
		toBe<
			DbtyperError<
				1901,
				'Backtick-quoted identifier is SQLite-only; this database is PostgreSQL. Use "double quotes"'
			>
		>(),
	)
	type Migration = GetApplyError<typeof pgMigrations, "insert or ignore into users (id) values (1);">
	expectType<Migration extends DbtyperError<1901, string> ? true : false>(toBe<true>())
})

test("DSEL-7: text the own dialect accepts is not an other-dialect error", () => {
	type A = GetQueryError<typeof sqliteDb, "select 1 as x where 'a' like 'A'">
	expectType<NotOtherDialect<A>>(toBe<true>())
	type B = GetQueryError<typeof pgDb, "select id::text as t from users">
	expectType<B>(toBe<null>())
	type C = GetQueryError<typeof pgDb, "select id from users where name ilike 'a%'">
	expectType<NotOtherDialect<C>>(toBe<true>())
})

test("known grammar gaps (#96) give no false other-dialect error", () => {
	// SQLite lexemes the shared lexer does not read: the gate stays silent instead of guessing
	type Blob = GetQueryError<typeof sqliteDb, "select x'ab' as b">
	expectType<NotOtherDialect<Blob>>(toBe<true>())
	type Hex = GetQueryError<typeof sqliteDb, "select 0x1F as h">
	expectType<NotOtherDialect<Hex>>(toBe<true>())
	type Sep = GetQueryError<typeof sqliteDb, "select 1_000 as n">
	expectType<NotOtherDialect<Sep>>(toBe<true>())
})

test("DSEL-7: rejected by both grammars is an ordinary error, not an other-dialect one", () => {
	type Pg = GetQueryError<typeof pgDb, "select from from users">
	expectType<NotOtherDialect<Pg>>(toBe<true>())
	type Sq = GetQueryError<typeof sqliteDb, "select from from users">
	expectType<NotOtherDialect<Sq>>(toBe<true>())
	expectType<Sq extends null ? true : false>(toBe<false>())
})
