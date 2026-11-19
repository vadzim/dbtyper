// Integration Test: DROP TABLE - Expected dot or end of table name (1703)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table items (id text not null);`).database()

// ❌ ERROR: Expected dot or end of table name in DROP TABLE
const query = `drop table items invalid garbage;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1703, "Expected `.` or end of table name in DROP TABLE">>())
