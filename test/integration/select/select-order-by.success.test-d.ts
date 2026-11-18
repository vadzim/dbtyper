// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, age integer);`)
	.database()
// ✅ SUCCESS: ORDER BY

const _result = await _db.query(`select * from users order by age desc, name;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
			age: number | null
		}>
	>(),
)
