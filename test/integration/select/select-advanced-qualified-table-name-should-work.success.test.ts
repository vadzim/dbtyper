// Integration Test: SELECT advanced features - qualified table name should work
// Integration Test: Advanced SELECT features
// Tests for SELECT *, aliases, qualified tables

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: qualified table name should work
	const result = await db.query(`select id, name from public.users;`)

	return result
}

test()
