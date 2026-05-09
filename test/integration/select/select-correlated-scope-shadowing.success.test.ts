// Integration Test: SELECT with correlated subquery and scope shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()
// ✅ SUCCESS: scope shadowing - inner 'users' shadows outer 'u', but 'u.id' still accessible

const _result = await _db.query(`select u.id from users u where exists (select 1 from users where users.id = u.id);`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			id: string
		}[]
	>
>
