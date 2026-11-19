// Integration Test: SELECT - array_length with non-array argument
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table items (id integer, priority integer);`).database()

// ❌ ERROR: array_length requires array type, but id is integer
const query = `select array_length(id, 1) as bad from items;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3614, "array_length expects (array, integer)">>())
