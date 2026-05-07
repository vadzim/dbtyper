// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()

// ❌ ERROR: type mismatch (text instead of integer)
await db.query(
	// @ts-expect-error
	`update users set age = 'not a number' where id = '1' returning *;`,
)
