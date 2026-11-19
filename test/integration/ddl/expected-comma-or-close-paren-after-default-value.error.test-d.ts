// Integration Test: Expected comma or close paren after DEFAULT value (5407)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

// ❌ ERROR: Expected comma or close paren after DEFAULT value
const query = `create table items (id text default 'test' invalid);` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<5407, "Expected `,` or `)` after DEFAULT value">>())
