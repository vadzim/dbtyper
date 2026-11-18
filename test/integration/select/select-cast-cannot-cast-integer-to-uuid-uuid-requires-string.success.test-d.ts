// Integration Test: SELECT with type casts - Cannot cast integer to uuid (uuid requires string)
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// EXPR-24: the unaliased cast is named after its operand column.
// Note: Cannot cast integer to uuid (uuid requires string) - runtime failure

const _result = await _db.query(`select id::uuid from data;`)

expectType<typeof _result>(
	toBe<
		{
			id: string
		}[]
	>(),
)
