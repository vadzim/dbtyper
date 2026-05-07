// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text, created_at text);`)
	.database()
// ✅ SUCCESS: correlated subquery

const _result = await db.query(
	`select * from posts p1 where exists (select 1 from posts p2 where p2.user_id = p1.user_id);`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: string
			user_id: string
			created_at: string
		}[]
	>
>
