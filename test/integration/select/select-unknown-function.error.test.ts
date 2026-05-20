// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { GetQueryError } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id integer, name text);`)
	.database()

// ❌ ERROR: Unknown function
const query = `select unknown_func(name) from t;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3619, "Unknown function: unknown_func">>())
