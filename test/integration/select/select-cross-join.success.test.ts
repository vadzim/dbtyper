// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table roles (id text, role_name text);`)
	.database()
// ✅ SUCCESS: CROSS JOIN (Cartesian product)

const _result = await db.query(`select users.name, roles.role_name from users cross join roles;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			name: string
			role_name: string
		}[]
	>
>
