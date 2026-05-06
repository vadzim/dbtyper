// Integration Test: UPDATE smoke tests - UPDATE invalid table
// Integration Test: UPDATE statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: UPDATE invalid table
const result = db.query(
	// @ts-expect-error
	`update invalid_table set name = null;`,
)
