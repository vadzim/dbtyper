// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	// ✅ SUCCESS: Enum types across multiple schemas
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create schema app;`)
		.apply(`create schema admin;`)
		.apply(`create type public.status as enum ('active', 'inactive');`)
		.apply(`create type app.priority as enum ('low', 'high');`)
		.apply(`create type admin.role as enum ('user', 'admin');`)
		.apply(`alter type public.status add value 'pending';`)
		.apply(`alter type app.priority add value 'medium';`)
		.apply(`alter type admin.role add value 'superadmin';`)
		.database()

	return db
}

test()
