// Integration Test: SELECT with array functions - unnest function
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


	// ✅ SUCCESS: unnest function
	const result = await db.query(`select unnest(tags) as tag from items;`)

	return result
}

test()
