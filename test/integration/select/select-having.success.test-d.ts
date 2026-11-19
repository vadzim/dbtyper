// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create table posts (id text, user_id text);`).database()
// ✅ SUCCESS: HAVING clause

const _result = await _db.query(`select user_id, count(*) as count from posts group by user_id having count(*) > 5;`)

expectType<typeof _result>(
	toBe<
		{
			count: string
			user_id: string | null
		}[]
	>(),
)
