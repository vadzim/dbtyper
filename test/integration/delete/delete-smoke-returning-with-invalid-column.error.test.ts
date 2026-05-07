// Integration Test: DELETE smoke tests - RETURNING with invalid column
// Integration Test: DELETE statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: RETURNING with invalid column
const _result = _db.query(
	// @ts-expect-error
	`delete from users returning invalid_column;`,
)
