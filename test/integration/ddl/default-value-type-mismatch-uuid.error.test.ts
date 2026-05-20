// Integration Test: DEFAULT value type mismatch - UUID function requires uuid column (5204)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ❌ ERROR: DEFAULT value type mismatch - UUID function requires uuid column
const query = `create table items (id text default gen_random_uuid());` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<5204, "DEFAULT value type mismatch: UUID function requires uuid column">>())
