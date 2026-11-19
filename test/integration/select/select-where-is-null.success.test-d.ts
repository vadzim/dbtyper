// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()
// ✅ SUCCESS: WHERE column IS NULL

const _result = await _db.query(`select * from users where name is null;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
		}>
	>(),
)
