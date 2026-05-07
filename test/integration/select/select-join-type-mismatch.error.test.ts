// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id integer, user_id text, title text);`)
	.database()

// ❌ ERROR: JOIN condition type mismatch (text vs integer)
await _db.query(
	// @ts-expect-error
	`select * from users inner join posts on users.id = posts.id;`,
)
