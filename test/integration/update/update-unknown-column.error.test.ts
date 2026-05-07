// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: unknown column in SET
await db.query(
	// @ts-expect-error
	`update users set invalid_column = 'value' where id = '1' returning *;`,
)
