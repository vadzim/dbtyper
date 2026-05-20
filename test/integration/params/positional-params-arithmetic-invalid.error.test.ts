// Integration Test: Positional Parameters - Arithmetic with invalid types
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ❌ ERROR: multiplication with number and string should fail
const query = `select ? * ? as result;` as const

// @ts-expect-error
await db.query(query, [5, "hello"])

type ReturnedError = GetQueryError<typeof db, typeof query, [number, string]>

expectType<ReturnedError>(toBe<DbtyperError<2501, "Incompatible types in arithmetic">>())
