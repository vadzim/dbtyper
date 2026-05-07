// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()
// ✅ SUCCESS: WHERE column BETWEEN

const _result = await db.query(`select * from users where age between 18 and 65;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			age: number
		}>
	>
>
