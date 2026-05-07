// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()
// ✅ SUCCESS: WHERE column IS NOT NULL

const _result = await _db.query(`delete from users where name is not null returning *;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			name: string
		}>
	>
>
