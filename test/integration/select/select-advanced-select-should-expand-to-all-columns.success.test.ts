// Integration Test: SELECT advanced features - SELECT * should expand to all columns
// Integration Test: Advanced SELECT features
// Tests for SELECT *, aliases, qualified tables

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: SELECT * should expand to all columns

const result = await db.query(`select * from users;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			name: string
			email: string
		}>
	>
>
