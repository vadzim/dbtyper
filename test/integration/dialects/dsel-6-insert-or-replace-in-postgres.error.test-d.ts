// Integration Test: DSEL-6, DSEL-7 - INSERT OR REPLACE in a PostgreSQL chain is a SQLite-only error (1901)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text);`)
	.database()

// ❌ ERROR: DSEL-6 INSERT OR REPLACE is SQLite syntax
const query = `insert or replace into users (id) values (1)` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<
		DbtyperError<1901, "INSERT OR REPLACE is SQLite-only; this database is PostgreSQL. Use ON CONFLICT … DO UPDATE">
	>(),
)
