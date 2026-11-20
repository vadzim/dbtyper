// CORE-7: a positional parameter whose type cannot be derived from its position asks for a CAST
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver }).database()

const query = `select $1 * $2 as result;` as const

// @ts-expect-error
await db.query(query, [5, 10])

type ReturnedError = GetQueryError<typeof db, typeof query, [number, number]>

expectType<ReturnedError>(toBe<DbtyperError<2405, "cannot infer the type of parameter $1; use CAST($1 AS …)">>())
