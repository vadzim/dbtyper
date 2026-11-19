// Integration Test: Expected new column name after TO in RENAME COLUMN (5402)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table items (id text not null);`).database()

// ❌ ERROR: Expected new column name after TO in RENAME COLUMN
const query = `alter table items rename column id to;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<5402, "Expected new column name after TO in RENAME COLUMN">>())
