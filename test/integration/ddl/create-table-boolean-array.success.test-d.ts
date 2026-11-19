// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: boolean array

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table flags (id integer not null, bits boolean[] not null);`)
	.database()

const _result = await _db.query(`select id, bits from flags;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			bits: readonly boolean[]
		}[]
	>(),
)
