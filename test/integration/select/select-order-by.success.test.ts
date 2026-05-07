// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, age integer);`)
	.database()
// ✅ SUCCESS: ORDER BY

const _result = await db.query(`select * from users order by age desc, name;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			name: string
			age: number
		}>
	>
>
