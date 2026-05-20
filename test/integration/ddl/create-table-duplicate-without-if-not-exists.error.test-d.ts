// Integration Test: CREATE TABLE
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema auth;`)
	.apply(`create table auth.dup (id text not null);`)
	.database()

// ❌ ERROR: CREATE TABLE without IF NOT EXISTS for existing table
const query = `create table auth.dup ( x int not null );` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3202, "Table already exists; use IF NOT EXISTS">>())
