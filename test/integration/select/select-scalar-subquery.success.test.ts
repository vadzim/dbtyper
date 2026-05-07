// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: scalar subquery in SELECT (non-correlated)

const _result = await db.query(`select id, name, (select count(*) from posts) as post_count from users;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			name: string
			id: string
			post_count: bigint
		}[]
	>
>
