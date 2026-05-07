// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ✅ SUCCESS: simple CTE

const _result = await db.query(
	`with active_users as (select * from users where id is not null) 
     select * from active_users;`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			name: string
			id: string
		}[]
	>
>
