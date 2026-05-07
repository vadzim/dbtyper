// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()

// ❌ ERROR: WHERE clause type mismatch
await db.query(
	// @ts-expect-error
	`select * from users where age = 'not a number';`,
)
