// Integration Test: SELECT with FULL OUTER JOIN - FULL OUTER JOIN with WHERE
// Integration Test: FULL OUTER JOIN
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()
// ✅ SUCCESS: FULL OUTER JOIN with WHERE

const _result = await db.query(
	`select * from users full outer join orders on users.id = orders.user_id where orders.total > 100;`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: number
		}[]
	>
>
