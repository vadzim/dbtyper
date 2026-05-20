// Integration Test: Basic SELECT - SELECT *
// Integration Test: Basic SELECT queries
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: SELECT *

const _result = await _db.query(`select * from users;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string
			name: string
			email: string
		}>
	>(),
)
