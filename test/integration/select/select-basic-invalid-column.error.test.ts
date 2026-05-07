// Integration Test: Basic SELECT - invalid column
// Integration Test: Basic SELECT queries
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()

// ❌ ERROR: invalid column
const result = db.query(
	// @ts-expect-error
	`select wrong_col from users;`,
)
