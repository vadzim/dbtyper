// Integration Test: SELECT with array functions - array_length function
// Integration Test: Array functions
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table items (id integer not null, tags text[] not null, nums integer[] not null);`)
		.database()


	// ✅ SUCCESS: array_length function
	const result = await db.query(`select array_length(tags, 1) as len from items;`)

	return result
}

test()
