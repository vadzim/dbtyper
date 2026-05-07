// Integration Test: SELECT || array concatenation with element (success)
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer, tags integer[]);`)
	.database()

// ✅ array || element → array
const result = await db.query(`select array[2,3] || 4 as result from users;`)
type _check = Expect<Matches<typeof result, Array<{ result: readonly number[] }>>>
