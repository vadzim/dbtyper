// Integration Test: DEFAULT value type mismatch - string (5202)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ❌ ERROR: DEFAULT value type mismatch - string literal for non-text column
const query = `create table items (id integer default 'text');` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<DbtyperError<5202, "DEFAULT value type mismatch: expected text/uuid column for string literal">>(),
)
