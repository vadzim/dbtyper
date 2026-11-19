// Integration Test: SELECT with type casts - Cast text to uuid
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// ✅ SUCCESS: Cast text to uuid

const _result = await _db.query(`select value::uuid as value_uuid from data;`)

expectType<typeof _result>(
	toBe<
		{
			value_uuid: string
		}[]
	>(),
)
