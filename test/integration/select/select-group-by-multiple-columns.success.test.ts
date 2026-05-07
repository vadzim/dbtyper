// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table posts (id text, user_id text, category text);`)
	.database()
// ✅ SUCCESS: GROUP BY multiple columns

const _result = await _db.query(`select user_id, category, count(*) as count from posts group by user_id, category;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			count: bigint
			user_id: string
			category: string
		}[]
	>
>
