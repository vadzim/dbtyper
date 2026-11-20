// Integration Test: DSEL-1 Check: SQLite chain types a backtick select and rejects :: (1900); PostgreSQL chain the reverse (1901 / string)
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ✅ SUCCESS: DSEL-1 SQLite chain, backtick-quoted identifier
const _liteRows = await lite.query("select `id` from users")
expectType<typeof _liteRows>(toBe<Array<{ id: number }>>())

// ✅ SUCCESS: DSEL-1 PostgreSQL chain, :: cast
const _pgRows = await pg.query("select id::text from users")
expectType<typeof _pgRows>(toBe<Array<{ id: string }>>())

// ❌ ERROR: DSEL-1 SQLite chain, :: cast is 1900
const liteQuery = "select id::text from users" as const
// @ts-expect-error
await lite.query(liteQuery)
expectType<GetQueryError<typeof lite, typeof liteQuery>>(
	toBe<DbtyperError<1900, "`::` cast is PostgreSQL-only; this database is SQLite. Use CAST(x AS TEXT)">>(),
)

// ❌ ERROR: DSEL-1 PostgreSQL chain, backtick is 1901
const pgQuery = "select `id` from users" as const
// @ts-expect-error
await pg.query(pgQuery)
expectType<GetQueryError<typeof pg, typeof pgQuery>>(
	toBe<
		DbtyperError<
			1901,
			'Backtick-quoted identifier is SQLite-only; this database is PostgreSQL. Use a double-quoted identifier ("name")'
		>
	>(),
)
