// Integration Test: SELECT with ANY/ALL/SOME operators - ANY with subquery
// Integration Test: ANY/ALL/SOME operators
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table items (id integer not null, tags text[] not null, priority integer not null);`)
		.apply(`create table priorities (value integer not null);`)
		.database()


	// ✅ SUCCESS: ANY with subquery
	const result = await db.query(`select * from items where priority = any(select value from priorities);`)

	return result
}

test()
