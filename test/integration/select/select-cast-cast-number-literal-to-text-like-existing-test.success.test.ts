// Integration Test: SELECT with type casts - Cast number literal to text (like existing test)
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table data (id integer not null, value text not null, num integer not null);`)
		.database()

	// ✅ SUCCESS: Cast number literal to text (like existing test)
	const result = await db.query(`select 42::text as num_text from data;`)

	return result
}

test()
