// Integration Test: SELECT with type casts - Cannot cast integer to uuid (uuid requires string)
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


	// ❌ ERROR: Cannot cast integer to uuid (uuid requires string)
	const result = await db.query(`select id::uuid from data;`)

	return result
}

test()
