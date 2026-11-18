// Integration Test: Scope shadowing - Subquery FROM scope shadows outer FROM scope
// Integration Test: Scope Shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: Subquery FROM scope shadows outer FROM scope

const _result = await _db.query(`
		select 
			(select posts.id from users as posts) as inner_id,
			posts.user_id as outer_user_id
		from posts;
	`)

expectType<typeof _result>(
	toBe<
		{
			inner_id: string | null
			outer_user_id: string | null
		}[]
	>(),
)
