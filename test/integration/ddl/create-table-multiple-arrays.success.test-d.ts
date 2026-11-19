// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: multiple array columns

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table multi (id integer not null, tags text[] not null, scores integer[] not null, flags boolean[] not null);`,
	)
	.database()

const _result = await _db.query(`select id, tags, scores, flags from multi;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			tags: readonly string[]
			flags: readonly boolean[]
			scores: readonly number[]
		}[]
	>(),
)
