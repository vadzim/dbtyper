// Integration Test: SQLT-6, SQLT-11, SQLT-18, SQLT-35, SQLT-43, SQLT-52, SQLT-53, SQLT-55 Checks (verification/sqlite.md @ 2a941c8)
// SQLT-6 column d (decimal) and SQLT-18 part 2 (1912) are in the sibling *.skip.ts files.
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver, sqliteBigintDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
const liteBig = sqlMigrations({ driver: sqliteBigintDriver })
const users = lite
	.apply(`create table users (id integer primary key, name text not null, email text, score real, avatar blob);`)
	.database()

// SQLT-6: column types by affinity (all but `d`), and `{ bigint: true }`
const t6 = `create table t (a bigint not null, b varchar(10) not null, c double precision not null, d decimal(10,2) not null, e blob not null, f not null)`
const _t6 = await lite.apply(t6).database().query(`select a, b, c, e, f from t`)
expectType<typeof _t6>(
	toBe<Array<{ a: number; b: string; c: number; e: Uint8Array; f: number | string | Uint8Array }>>(),
)
const _t6Big = await liteBig.apply(t6).database().query(`select a, c from t`)
expectType<typeof _t6Big>(toBe<Array<{ a: bigint; c: number }>>())

// ❌ ERROR: SQLT-11 STRICT allows only INT, INTEGER, REAL, TEXT, BLOB, ANY
const s11 = `create table s (a varchar(5)) strict` as const
// @ts-expect-error
lite.apply(s11)
expectType<GetApplyError<typeof lite, typeof s11>>(
	toBe<DbtyperError<1910, "STRICT tables allow only INT, INTEGER, REAL, TEXT, BLOB, ANY">>(),
)

// ❌ ERROR: SQLT-18 WITHOUT ROWID needs a PRIMARY KEY; with one the table is applied and `b` is read-only (CORE-18)
const s18 = `create table g (a integer not null, b integer as (a * 2) stored) strict, without rowid` as const
// @ts-expect-error
lite.apply(s18)
expectType<GetApplyError<typeof lite, typeof s18>>(
	toBe<DbtyperError<1913, "WITHOUT ROWID tables need a PRIMARY KEY">>(),
)
const g = lite
	.apply(`create table g (a integer primary key, b integer as (a * 2) stored) strict, without rowid`)
	.database()
const _g = await g.query(`select a, b from g`)
expectType<typeof _g>(toBe<Array<{ a: number; b: number | null }>>())
const gSet = `insert into g (a, b) values (1, 2)` as const
// @ts-expect-error
g.query(gSet)

// SQLT-35: `{ bigint: true }`: integer division is bigint, real division number
const big = liteBig.database()
const _t35 = await big.query(`select 7 / 2 as a, 7 / 2.0 as b`)
expectType<typeof _t35>(toBe<Array<{ a: bigint; b: number }>>())

// ❌ ERROR: SQLT-43 a number into a TEXT column
const s43 = `insert into users (name) values (42)` as const
// @ts-expect-error
users.query(s43)
expectType<GetQueryError<typeof users, typeof s43>>(toBe<DbtyperError<2510, "column `name` is TEXT">>())

// ❌ ERROR: SQLT-52 now() is PostgreSQL-only
const s52 = `select now()` as const
// @ts-expect-error
users.query(s52)
expectType<GetQueryError<typeof users, typeof s52>>(
	toBe<DbtyperError<3619, "Unknown function: now. now() is PostgreSQL-only; use datetime('now') or CURRENT_TIMESTAMP">>(),
)

// ❌ ERROR: SQLT-53 ILIKE
const s53 = `select * from users where name ilike 'a%'` as const
// @ts-expect-error
users.query(s53)
expectType<GetQueryError<typeof users, typeof s53>>(
	toBe<DbtyperError<1900, "ILIKE is PostgreSQL-only; this database is SQLite. In SQLite LIKE is already case-insensitive">>(),
)

// SQLT-55: a valid conflict action is accepted, an unknown one is 1920
lite.apply(`create table t (id integer primary key on conflict replace);`)
const s55 = `create table t (id integer primary key on conflict explode);` as const
// @ts-expect-error
lite.apply(s55)
expectType<GetApplyError<typeof lite, typeof s55>>(
	toBe<DbtyperError<1920, "Expected ROLLBACK, ABORT, FAIL, IGNORE or REPLACE after ON CONFLICT">>(),
)
