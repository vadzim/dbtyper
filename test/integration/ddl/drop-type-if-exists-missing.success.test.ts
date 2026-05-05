// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	// ✅ SUCCESS: DROP TYPE IF EXISTS (non-existing type, no-op)
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`drop type if exists missing;`)
		.database()

	return db
}

test()
