// Integration Test: DELETE smoke tests - RETURNING with invalid column
// Integration Test: DELETE statements
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

// ❌ ERROR: RETURNING with invalid column
const result = db.query(
	// @ts-expect-error
	`delete from users returning invalid_column;`,
)
