// Integration Test: SELECT with array functions - array_append with integer array
// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: array_append with integer array

const _result = await _db.query(`select array_append(nums, 42) as nums_appended from items;`)

expectType<typeof _result>(
	toBe<
		{
			nums_appended: readonly number[]
		}[]
	>(),
)
