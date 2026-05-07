// Integration Test: SELECT advanced features - qualified table name should work
// Integration Test: Advanced SELECT features
// Tests for SELECT *, aliases, qualified tables

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: qualified table name should work

const _result = await _db.query(`select id, name from public.users;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			name: string
		}>
	>
>
