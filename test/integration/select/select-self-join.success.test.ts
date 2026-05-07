// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, manager_id text);`)
	.database()

// ✅ SUCCESS: self-join

const _result = await _db.query(
	`select u1.name as employee, u2.name as manager 
     from users u1 
     left join users u2 on u1.manager_id = u2.id;`,
)

type _check = Expect<
	Matches<
		typeof _result,
		{
			employee: string
			manager: string
		}[]
	>
>
