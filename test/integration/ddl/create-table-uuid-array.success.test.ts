// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: uuid array

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table refs (id integer not null, uuids uuid[] not null);`)
	.database()

const _result = await _db.query(`select id, uuids from refs;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			uuids: readonly string[]
		}[]
	>(),
)
