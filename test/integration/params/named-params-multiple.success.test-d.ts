// Integration Test: Named Parameters - Multiple params
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()

// ✅ SUCCESS: named parameters with record (backward compatibility)
const _result = await _db.query(`select * from users where id = :userId and age > :minAge;`, {
	userId: "user1",
	minAge: 18,
})

expectType<typeof _result>(
	toBe<
		Array<{
			id: string
			age: number
			active: boolean
		}>
	>(),
)
