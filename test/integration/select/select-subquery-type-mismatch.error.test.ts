// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id integer);`)
	.database()

// ❌ ERROR: subquery type mismatch
await db.query(
	// @ts-expect-error
	`select * from users where id in (select user_id from posts);`,
)
