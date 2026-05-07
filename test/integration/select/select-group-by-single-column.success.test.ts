// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table posts (id text, user_id text, title text);`)
	.database()
// ✅ SUCCESS: GROUP BY single column

const _result = await db.query(`select user_id, count(*) as post_count from posts group by user_id;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			user_id: string
			post_count: bigint
		}[]
	>
>
