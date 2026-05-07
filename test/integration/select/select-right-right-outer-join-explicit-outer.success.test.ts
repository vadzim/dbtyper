// Integration Test: SELECT with RIGHT JOIN - RIGHT OUTER JOIN (explicit OUTER)
// Integration Test: RIGHT JOIN
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()
// ✅ SUCCESS: RIGHT OUTER JOIN (explicit OUTER)

const _result = await db.query(`select * from users right outer join orders on users.id = orders.user_id;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
		}[]
	>
>
