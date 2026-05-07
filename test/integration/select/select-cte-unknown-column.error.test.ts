// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: reference unknown column from CTE
await db.query(
	// @ts-expect-error
	`with active_users as (select id, name from users) 
     select invalid_column from active_users;`,
)
