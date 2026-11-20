// Integration Test: DSEL-6 Check: PostgreSQL chain, INSERT OR REPLACE and backtick identifiers are 1901
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ❌ ERROR: DSEL-6 INSERT OR REPLACE
const replace = "insert or replace into users (id) values (1)" as const
// @ts-expect-error
await pg.query(replace)
expectType<GetQueryError<typeof pg, typeof replace>>(
	toBe<
		DbtyperError<1901, "INSERT OR REPLACE is SQLite-only; this database is PostgreSQL. Use ON CONFLICT … DO UPDATE">
	>(),
)

// ❌ ERROR: DSEL-6 backtick
const tick = "select `id` from users" as const
// @ts-expect-error
await pg.query(tick)
expectType<GetQueryError<typeof pg, typeof tick>>(
	toBe<
		DbtyperError<
			1901,
			'Backtick-quoted identifier is SQLite-only; this database is PostgreSQL. Use a double-quoted identifier ("name")'
		>
	>(),
)
