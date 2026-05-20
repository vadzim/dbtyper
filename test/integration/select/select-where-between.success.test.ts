// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()
// ✅ SUCCESS: WHERE column BETWEEN

const _result = await _db.query(`select * from users where age between 18 and 65;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string
			age: number
		}>
	>(),
)
