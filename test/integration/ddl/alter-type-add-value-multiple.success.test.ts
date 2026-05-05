// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	// ✅ SUCCESS: ALTER TYPE ADD VALUE multiple times
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active');`)
		.apply(`alter type status add value 'inactive';`)
		.apply(`alter type status add value 'pending';`)
		.apply(`alter type status add value 'archived';`)
		.database()

	return db
}

test()
