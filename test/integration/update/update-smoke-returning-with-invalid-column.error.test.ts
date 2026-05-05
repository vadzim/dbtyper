// Integration Test: UPDATE smoke tests - RETURNING with invalid column
// Integration Test: UPDATE statements
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

	// ❌ ERROR: RETURNING with invalid column
	const result = await db.query(
		// @ts-expect-error
		`update users set name = null returning invalid_column;`,
	)

	return result
}

test()
