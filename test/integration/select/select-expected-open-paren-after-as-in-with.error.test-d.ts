// Integration Test: SELECT - Expected open paren after AS in WITH
// Integration Test: WITH clause syntax validation
// Tests that CTE definition requires opening parenthesis after AS

import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

// ❌ ERROR: missing opening parenthesis after AS in WITH
const query = `WITH cte AS SELECT 1) SELECT *; SELECT 42;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1116, "Expected open paren after AS in WITH">>())
