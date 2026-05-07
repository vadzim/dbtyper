// Integration Test: UPDATE smoke tests - UPDATE invalid column
// Integration Test: UPDATE statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: UPDATE invalid column
const _result = _db.query(
	// @ts-expect-error
	`update users set invalid_column = null;`,
)
