// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text);`)
	.database()

// ❌ ERROR: SET NULL into NOT NULL column
await _db.query(
	// @ts-expect-error
	`update users set id = null where name = 'Alice' returning *;`,
)
