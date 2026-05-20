// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

// ✅ SUCCESS: nullable array

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table optional (id integer not null, tags text[]);`)
	.database()

const _result = await _db.query(`select id, tags from optional;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			tags: readonly string[] | null
		}[]
	>(),
)
