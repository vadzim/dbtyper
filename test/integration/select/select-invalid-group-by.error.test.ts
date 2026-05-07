// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table posts (id text, user_id text, title text);`)
	.database()

// ❌ ERROR: SELECT non-grouped column without aggregate
await db.query(
	// @ts-expect-error
	`select user_id, title, count(*) from posts group by user_id;`,
)
