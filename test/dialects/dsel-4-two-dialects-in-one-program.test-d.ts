// DSEL-4, DSEL-1, DSEL-3, DSEL-11: a PostgreSQL and a SQLite database in one program, each typed in its own dialect.
import { sqlMigrations, type GetQueryError, type GetStreamError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

const lite = sqlMigrations({ driver: sqliteMockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// DSEL-4, DSEL-11: the same SQL has the same type in both
const _pgOne = await pg.query(`select 1 as x`)
const _liteOne = await lite.query(`select 1 as x`)
expectType<typeof _pgOne>(toBe<Array<{ x: number }>>())
expectType<typeof _liteOne>(toBe<Array<{ x: number }>>())

// DSEL-4: PostgreSQL syntax is accepted by the PostgreSQL database only
const _pgCast = await pg.query(`select id::text as t from users`)
expectType<typeof _pgCast>(toBe<Array<{ t: string }>>())

const _castQuery = `select id::text as t from users` as const
type LiteCast = GetQueryError<typeof lite, typeof _castQuery>
expectType<LiteCast>(
	toBe<DbtyperError<1900, "`::` cast is PostgreSQL-only; this database is SQLite. Use CAST(x AS TEXT)">>(),
)
type PgCast = GetQueryError<typeof pg, typeof _castQuery>
expectType<PgCast>(toBe<null>())

// DSEL-3: streams of a SQLite chain are parsed as SQLite too
type LiteStreamCast = GetStreamError<typeof lite, typeof _castQuery>
expectType<LiteStreamCast>(
	toBe<DbtyperError<1900, "`::` cast is PostgreSQL-only; this database is SQLite. Use CAST(x AS TEXT)">>(),
)

// DSEL-6: SQLite syntax is rejected by the PostgreSQL database with its own code (DSEL-7), not a syntax error
const _backtickQuery = "select `name` from users" as const
type PgBacktick = GetQueryError<typeof pg, typeof _backtickQuery>
expectType<PgBacktick>(
	toBe<
		DbtyperError<
			1901,
			'Backtick-quoted identifier is SQLite-only; this database is PostgreSQL. Use a double-quoted identifier ("name")'
		>
	>(),
)

// DSEL-7: "wrong engine" (1900) has its own code, distinct from a typo's syntax error in the same database
const _dollarQuery = `select name from users where id = $1` as const
type LiteDollar = GetQueryError<typeof lite, typeof _dollarQuery, [number]>
expectType<LiteDollar>(
	toBe<DbtyperError<1900, "`$n` positional parameter is PostgreSQL-only; this database is SQLite. Use ? or ?NNN">>(),
)
const _typoQuery = `select name from users wher id = 1` as const
type LiteTypo = GetQueryError<typeof lite, typeof _typoQuery>
expectType<LiteTypo>(toBe<DbtyperError<1105, "Expected semicolon after SELECT">>())
