// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, age integer);`)
	.database()
// ✅ SUCCESS: DELETE with complex WHERE

const _result = await _db.query(`delete from users where age < 18 or name is null returning *;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
			age: number | null
		}>
	>(),
)
