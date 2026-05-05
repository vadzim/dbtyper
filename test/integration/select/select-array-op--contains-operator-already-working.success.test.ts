// Integration Test: SELECT with array operators - @> (contains) operator - already working
// Integration Test: Array operators
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

	// ✅ SUCCESS: @> (contains) operator - already working
	const result = await db.query(`select tags @> array['a'] as contains from items;`)

	return result
}

test()
