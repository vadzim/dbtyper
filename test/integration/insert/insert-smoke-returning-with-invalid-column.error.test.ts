// Integration Test: INSERT smoke tests - RETURNING with invalid column
// Integration Test: INSERT statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: RETURNING with invalid column
const result = db.query(
	// @ts-expect-error
	`insert into users (id, name) values (null, null) returning invalid_column;`,
)
