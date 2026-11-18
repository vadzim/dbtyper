// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text, title text);`)
	.apply(`create table comments (id text, post_id text, content text);`)
	.database()

// ✅ SUCCESS: multiple LEFT JOINs (nullability propagates)

const _result = await _db.query(
	`select users.name, posts.title, comments.content 
     from users 
     left join posts on users.id = posts.user_id 
     left join comments on posts.id = comments.post_id;`,
)

expectType<typeof _result>(
	toBe<
		{
			name: string | null
			title: string | null
			content: string | null
		}[]
	>(),
)
