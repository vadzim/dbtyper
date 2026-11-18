// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ✅ SUCCESS: RETURNING *

const _result = await _db.query(`update users set name = 'Alice' where id = '1' returning *;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
			email: string | null
		}>
	>(),
)
