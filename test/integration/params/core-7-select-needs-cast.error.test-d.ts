// CORE-7: `select :x as x` has no type for :x; CAST gives one
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

const query = `select :x as x;` as const

// @ts-expect-error
await db.query(query, { x: "s" })

type ReturnedError = GetQueryError<typeof db, typeof query, { x: string }>

expectType<ReturnedError>(toBe<DbtyperError<2405, "cannot infer the type of parameter :x; use CAST(:x AS …)">>())
