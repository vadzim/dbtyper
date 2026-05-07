// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: unknown column in WHERE
await _db.query(
	// @ts-expect-error
	`delete from users where invalid_column = '1' returning *;`,
)
