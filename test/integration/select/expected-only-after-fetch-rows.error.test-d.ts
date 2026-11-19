// Integration Test: Expected ONLY after FETCH ROWS (5303)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table items (id text not null);`).database()

// ❌ ERROR: Expected ONLY after FETCH ROWS
const query = `select id from items fetch first 10 rows invalid;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<5303, "Expected ONLY after FETCH … ROWS">>())
