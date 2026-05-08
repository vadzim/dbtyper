// Integration Test: Basic SELECT - SELECT named columns
// Integration Test: Basic SELECT queries
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: SELECT named columns

const _result = await _db.query(`select id, name from users;`)

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			name: string
		}>
	>
>
