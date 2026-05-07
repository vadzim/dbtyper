// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: RETURNING unknown column
await _db.query(
	// @ts-expect-error
	`update users set name = 'Alice' where id = '1' returning invalid_column;`,
)
