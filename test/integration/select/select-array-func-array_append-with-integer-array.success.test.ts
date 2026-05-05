// Integration Test: SELECT with array functions - array_append with integer array
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


	// ✅ SUCCESS: array_append with integer array
	const result = await db.query(`select array_append(nums, 42) as nums_appended from items;`)

	return result
}

test()
