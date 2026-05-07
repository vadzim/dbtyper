// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: HAVING clause

const _result = await db.query(`select user_id, count(*) as count from posts group by user_id having count(*) > 5;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			count: bigint
			user_id: string
		}[]
	>
>
