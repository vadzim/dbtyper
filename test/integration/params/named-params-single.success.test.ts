// Integration Test: Named Parameters - Single param
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()

// ✅ SUCCESS: single named parameter
const _result = await _db.query(`select * from users where id = :userId;`, { userId: "user1" })

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			age: number
			active: boolean
		}>
	>
>
