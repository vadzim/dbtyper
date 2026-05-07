// Integration Test: SELECT advanced features - column aliases should work
// Integration Test: Advanced SELECT features
// Tests for SELECT *, aliases, qualified tables

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: column aliases should work

const _result = await db.query(`select id as user_id, name as user_name from users;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			user_id: string
			user_name: string
		}[]
	>
>
