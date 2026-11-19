// Integration Test: SELECT - ANY with non-array column
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create table items (id integer, priority integer);`).database()

// ❌ ERROR: ANY requires array type, but priority is integer
const query = `select * from items where id = any(priority);` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3001, "ANY/ALL/SOME requires an array or subquery">>())
