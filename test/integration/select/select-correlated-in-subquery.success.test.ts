// Integration Test: SELECT with correlated IN subquery
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, created_at text);`)
	.apply(`create table posts (id text, user_id text, created_at text);`)
	.database()
// ✅ SUCCESS: correlated IN subquery in WHERE clause

const _result = await _db.query(
	`select * from users u where u.id in (select user_id from posts where posts.created_at > u.created_at);`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: string
			name: string
			created_at: string
		}[]
	>
>
