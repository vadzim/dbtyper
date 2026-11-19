// Integration Test: Expected FIRST or NEXT after FETCH (5300)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table items (id text not null);`).database()

// ❌ ERROR: Expected FIRST or NEXT after FETCH
const query = `select id from items fetch invalid 10 rows only;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<5300, "Expected FIRST or NEXT after FETCH">>())
