// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null);`)
	.apply(`create table posts (id text not null, user_id text not null);`)
	.database()

// ✅ SUCCESS: CTE in JOIN with type checking

const _result = await db.query(
	`with active_users as (
       select id, name from users
     )
     select active_users.name, posts.id 
     from active_users 
     left join posts on active_users.id = posts.user_id;`,
)

type _check = Expect<
	Matches<
		typeof result,
		{
			name: string
			id: string
		}[]
	>
>
