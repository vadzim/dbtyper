// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// // TYPE-3: serial/smallserial/bigserial are typed like integer/smallint/bigint
// ✅ SUCCESS: serial types (auto-increment)

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table counters (id serial not null, count bigserial not null, small smallserial not null);`)
	.database()

const _result = await _db.query(`select id, count, small from counters;`)

expectType<typeof _result>(
	toBe<
		{
			small: number
			count: bigint
			id: number
		}[]
	>(),
)
