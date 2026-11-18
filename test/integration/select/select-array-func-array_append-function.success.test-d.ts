// Integration Test: SELECT with array functions - array_append function
// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: array_append function

const _result = await _db.query(`select array_append(tags, 'new') as appended from items;`)

expectType<typeof _result>(
	toBe<
		{
			appended: readonly string[]
		}[]
	>(),
)
