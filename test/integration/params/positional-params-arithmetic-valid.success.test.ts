// Integration Test: Positional Parameters - Arithmetic with valid types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.database()

// ✅ SUCCESS: multiplication with two numbers
const _result = await _db.query(`select ? * ? as result;`, [5, 10])

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			result: number
		}>
	>
>
