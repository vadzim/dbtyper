// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()
// ✅ SUCCESS: correct types in WHERE

const _result = await db.query(`delete from users returning *;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			age: number
			active: boolean
		}>
	>
>
