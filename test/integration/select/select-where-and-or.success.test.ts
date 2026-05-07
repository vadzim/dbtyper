// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()
// ✅ SUCCESS: WHERE with AND/OR

const _result = await db.query(`select * from users where (age > 18 and active = true) or id = 'admin';`)

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
