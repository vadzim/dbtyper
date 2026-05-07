// Integration Test: db․stream() rejects non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ UPDATE without RETURNING should be rejected by stream()
db.stream(
	// @ts-expect-error
	`update users set name = 'Bob' where id = '1';`,
)
