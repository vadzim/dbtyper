// Integration Test: PARAM-13 - too few positional parameters
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()

// ❌ ERROR: PARAM-13 two `?` but one value
const query = `select * from users where id = ? and age > ?;` as const

// @ts-expect-error
await db.query(query, ["a"])

type ReturnedError = GetQueryError<typeof db, typeof query, ["a"]>
expectType<ReturnedError>(toBe<DbtyperError<2404, "Positional parameter index 1 is out of bounds">>())
