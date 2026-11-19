// Integration Test: SELECT - Expected table name or open paren in FROM
// Integration Test: FROM clause syntax validation
// Tests that FROM clause requires table name or subquery

import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

// ❌ ERROR: missing table name or subquery after FROM
const query = `SELECT * FROM WHERE true; SELECT 42;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1121, "Expected table name or \`(\` in FROM">>())
