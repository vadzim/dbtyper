// Integration Test: DROP TABLE
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema auth;`)
	.apply(`create table auth.items (id text not null);`)
	.database()

// ❌ ERROR: DROP TABLE with garbage after table name
const query = `drop table auth.items extra ;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1105, "Expected semicolon after qualified table name in DROP TABLE">>())
