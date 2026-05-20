// Integration Test: SELECT with type casts - Cannot cast boolean to integer
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null, flag boolean not null);`)
	.database()

// ❌ ERROR: Cannot cast boolean to integer
const query = `select flag::integer from data;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<4503, "Cannot cast boolean to integer">>())
