// Integration Test: SELECT - Qualified table.* only valid in SELECT lists (3405)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table items (id text not null, name text not null);`)
	.database()

// ❌ ERROR: Qualified table.* is only valid in SELECT lists
const query = `select id from items where items.* = true;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3405, "Qualified table .* is only valid in SELECT lists">>())
