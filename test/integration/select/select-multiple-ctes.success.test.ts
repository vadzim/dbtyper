// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()

// ✅ SUCCESS: multiple CTEs

const result = await db.query(
	`with 
       active_users as (select * from users where id is not null),
       user_posts as (select * from posts where user_id is not null)
     select * from active_users 
     inner join user_posts on active_users.id = user_posts.user_id;`,
)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: string
		}[]
	>
>
