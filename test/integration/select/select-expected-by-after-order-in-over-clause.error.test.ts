// Integration Test: SELECT - Expected BY after ORDER in OVER clause
// Integration Test: Window function syntax validation
// Tests that ORDER in OVER clause requires BY keyword

import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer, name text);`)
	.database()

// ❌ ERROR: missing BY keyword after ORDER in OVER clause
const query = `SELECT ROW_NUMBER() OVER (ORDER) FROM users;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1109, "Expected BY after ORDER in OVER clause">>())
