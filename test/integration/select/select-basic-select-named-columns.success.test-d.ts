// Integration Test: Basic SELECT - SELECT named columns
// Integration Test: Basic SELECT queries
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: SELECT named columns

const _result = await _db.query(`select id, name from users;`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
			name: string | null
		}>
	>(),
)
