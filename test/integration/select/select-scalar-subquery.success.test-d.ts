// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: scalar subquery in SELECT (non-correlated)

const _result = await _db.query(`select id, name, (select count(*) from posts) as post_count from users;`)

expectType<typeof _result>(
	toBe<
		{
			name: string | null
			id: string | null
			post_count: string | null
		}[]
	>(),
)
