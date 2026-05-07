// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: unknown column
await _db.query(
	// @ts-expect-error
	`insert into users (id, invalid_column) values ('1', 'value') returning *;`,
)
