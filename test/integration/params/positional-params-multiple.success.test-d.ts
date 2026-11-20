// Integration Test: Positional Parameters - Multiple params
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()

// ✅ SUCCESS: positional parameters with array
const _result = await _db.query(`select * from users where id = $1 and age > $2;`, ["user1", 18])

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			age: number | null
			active: boolean | null
		}>
	>(),
)
