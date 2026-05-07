// Integration Test: INSERT smoke tests - Invalid table name
// Integration Test: INSERT statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: Invalid table name
const _result = _db.query(
	// @ts-expect-error
	`insert into invalid_table (id) values (null);`,
)
