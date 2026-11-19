// Integration Test: Named Parameters - Single param
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()

// ✅ SUCCESS: single named parameter
const _result = await _db.query(`select * from users where id = :userId;`, { userId: "user1" })

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			age: number | null
			active: boolean | null
		}>
	>(),
)
