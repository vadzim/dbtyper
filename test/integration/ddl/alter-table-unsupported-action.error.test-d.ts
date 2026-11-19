// Integration Test: ALTER TABLE
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table items (id text not null, title text not null);`)
	.database()

// ❌ ERROR: ALTER TABLE with unsupported action
const query = `alter table public.items freeze;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<DbtyperError<5405, "Unsupported ALTER TABLE action; run this statement with queryUntyped">>(),
)
