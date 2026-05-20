// Integration Test: SELECT with array operators - Multiple operators in WHERE
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: Multiple operators in WHERE

const _result = await _db.query(`select * from items where tags @> array['important'];`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			tags: readonly string[]
			nums: readonly number[]
		}[]
	>(),
)
