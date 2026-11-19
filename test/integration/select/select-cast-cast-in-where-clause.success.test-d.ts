// Integration Test: SELECT with type casts - Cast in WHERE clause
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// ✅ SUCCESS: Cast in WHERE clause

const _result = await _db.query(`select * from data where id::text = '123';`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: number
			value: string
			num: number
		}>
	>(),
)
