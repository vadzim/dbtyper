// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	// ✅ SUCCESS: Multiple enum types with different lifecycles
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive');`)
		.apply(`create type priority as enum ('low', 'high');`)
		.apply(`alter type status add value 'pending';`)
		.apply(`alter type priority add value 'medium';`)
		.apply(`drop type status;`)
		.apply(`create type status as enum ('new', 'old');`)
		.database()

	return db
}

test()
