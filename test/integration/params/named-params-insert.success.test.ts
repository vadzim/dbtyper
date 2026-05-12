// Integration Test: Named Parameters - INSERT with RETURNING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()

// ✅ SUCCESS: named parameters in INSERT
const _result = await _db.query(`insert into users (id, age, active) values (:id, :age, :active) returning *;`, {
	id: "user2",
	age: 25,
	active: true,
})

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
