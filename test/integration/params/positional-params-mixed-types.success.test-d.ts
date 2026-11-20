// Integration Test: Positional Parameters - Mixed types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()

// ✅ SUCCESS: multiple positional parameters with different types
const _result = await _db.query(`select * from users where id = $1 and age > $2 and active = $3;`, ["user1", 18, true])

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			age: number | null
			active: boolean | null
		}>
	>(),
)
