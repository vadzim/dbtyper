// Integration Test: CORE-16 DEFAULT value type mismatch - UUID function requires uuid column
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

// ❌ ERROR: DEFAULT value type mismatch - UUID function requires uuid column
const query = `create table items (id text default gen_random_uuid());` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2507, "Incompatible value type for column id">>())
