// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()
// ✅ SUCCESS: correct types

const _result = await db.query(`update users set age = 30, active = false where id = '1' returning *;`)

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
