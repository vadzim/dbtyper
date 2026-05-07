// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, age integer);`)
	.database()
// ✅ SUCCESS: UPDATE with complex WHERE

const _result = await _db.query(`update users set name = 'Adult' where age >= 18 returning *;`)

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
