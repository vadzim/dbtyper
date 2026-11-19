// Integration Test: SELECT with array operators - Array concatenation with column
// Integration Test: Array operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
	.database()
// ✅ SUCCESS: Array concatenation with column

const _result = await _db.query(`select tags || tags as doubled from items;`)

expectType<typeof _result>(
	toBe<
		{
			doubled: readonly string[]
		}[]
	>(),
)
