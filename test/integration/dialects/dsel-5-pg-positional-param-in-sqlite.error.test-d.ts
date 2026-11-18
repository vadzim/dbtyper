// Integration Test: DSEL-5, DSEL-7 - a $n positional parameter in a SQLite chain is a PostgreSQL-only error (1900)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { sqliteMockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: sqliteMockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ❌ ERROR: DSEL-5 `$1` is PostgreSQL syntax
const query = `select name from users where id = $1` as const

// @ts-expect-error
await db.query(query, [1])

type ReturnedError = GetQueryError<typeof db, typeof query, [number]>

expectType<ReturnedError>(
	toBe<DbtyperError<1900, "`$n` positional parameter is PostgreSQL-only; this database is SQLite. Use ? or ?NNN">>(),
)
