// Integration Test: SEL-Q4 unsupported keyword after the FROM table (SPEC-Q SEL-Q4, current generic behaviour; UNION itself is supported since CORE-8)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// Current generic behaviour, not a deliberate message: see SPEC-Q SEL-Q4.
// ❌ ERROR: unsupported keyword after the FROM table (SPEC-Q SEL-Q4, current generic behaviour; UNION itself is supported since CORE-8)
const query = `select id from users lateral;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1115, "Expected alias or join clause after table">>())
