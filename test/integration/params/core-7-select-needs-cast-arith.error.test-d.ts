// CORE-7: `:x + 1` has no column to take a type from
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

const query = `select :x + 1 as a;` as const

// @ts-expect-error
await db.query(query, { x: 1 })

type ReturnedError = GetQueryError<typeof db, typeof query, { x: number }>

expectType<ReturnedError>(toBe<DbtyperError<2405, "cannot infer the type of parameter :x; use CAST(:x AS …)">>())
