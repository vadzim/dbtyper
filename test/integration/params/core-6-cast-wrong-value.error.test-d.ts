// CORE-6: a value of another type than the CAST's is a compile error at the call site
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

const query = `select cast(:x as text) as x;` as const

// @ts-expect-error
await db.query(query, { x: 1 })

type ReturnedError = GetQueryError<typeof db, typeof query, { x: number }>

expectType<ReturnedError>(toBe<DbtyperError<2509, "Incompatible value type for parameter :x">>())
