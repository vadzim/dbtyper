// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text, title text);`)
	.apply(`create table comments (id text, post_id text, content text);`)
	.database()

// ✅ SUCCESS: multiple LEFT JOINs (nullability propagates)

const _result = await db.query(
	`select users.name, posts.title, comments.content 
     from users 
     left join posts on users.id = posts.user_id 
     left join comments on posts.id = comments.post_id;`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			name: string
			title: string
			content: string
		}[]
	>
>
