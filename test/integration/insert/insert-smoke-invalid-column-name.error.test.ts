// Integration Test: INSERT smoke tests - Invalid column name
// Integration Test: INSERT statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: Invalid column name
const result = db.query(
	// @ts-expect-error
	`insert into users (id, invalid_column) values (null, null);`,
)
