// Integration Test: SELECT with type casts - Cast integer column to text
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()
// ✅ SUCCESS: Cast integer column to text

const _result = await _db.query(`select id::text as id_text from data;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id_text: string
		}>
	>(),
)
