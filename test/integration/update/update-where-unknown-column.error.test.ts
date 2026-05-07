// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: unknown column in WHERE
await db.query(
	// @ts-expect-error
	`update users set name = 'Alice' where invalid_column = '1' returning *;`,
)
