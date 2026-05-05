// Integration Test: INSERT smoke tests - Invalid table name
// Integration Test: INSERT statements
// Minimal tests demonstrating API functionality

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


	// ❌ ERROR: Invalid table name
	const result = await db.query(// @ts-expect-error
		`insert into invalid_table (id) values (null);`,)

	return result
}

test()
