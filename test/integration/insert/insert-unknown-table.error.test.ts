// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: unknown table
await _db.query(
	// @ts-expect-error
	`insert into nonexistent (id) values ('1') returning *;`,
)
