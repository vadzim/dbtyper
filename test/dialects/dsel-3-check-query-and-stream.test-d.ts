// Integration Test: DSEL-3 Check: query and stream are parsed in the chain's dialect (1900 on SQLite, 1901 on PostgreSQL)
import {
	sqlMigrations,
	type GetQueryError,
	type GetStreamError,
	type GetApplyError,
} from "../../src/core/sql-database.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

const cast = "select id::text from users" as const
const tick = "select `id` from users" as const
type CastError = DbtyperError<1900, "`::` cast is PostgreSQL-only; this database is SQLite. Use CAST(x AS TEXT)">
type TickError = DbtyperError<
	1901,
	'Backtick-quoted identifier is SQLite-only; this database is PostgreSQL. Use a double-quoted identifier ("name")'
>

// ❌ ERROR: DSEL-3 SQLite chain query and stream
// @ts-expect-error
await lite.query(cast)
// @ts-expect-error
await lite.stream(cast)
expectType<GetQueryError<typeof lite, typeof cast>>(toBe<CastError>())
expectType<GetStreamError<typeof lite, typeof cast>>(toBe<CastError>())

// ❌ ERROR: DSEL-3 PostgreSQL chain query and stream
// @ts-expect-error
await pg.query(tick)
// @ts-expect-error
await pg.stream(tick)
expectType<GetQueryError<typeof pg, typeof tick>>(toBe<TickError>())
expectType<GetStreamError<typeof pg, typeof tick>>(toBe<TickError>())

// ❌ ERROR: DSEL-3 the migration of a SQLite chain is parsed as SQLite
const migrations = sqlMigrations({ driver: sqliteDriver })
const migration = "create table t (a text not null default 'x'::text)" as const
// @ts-expect-error
migrations.apply(migration)
expectType<GetApplyError<typeof migrations, typeof migration>>(toBe<CastError>())
