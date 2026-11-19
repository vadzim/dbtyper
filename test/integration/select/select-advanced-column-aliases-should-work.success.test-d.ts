// Integration Test: SELECT advanced features - column aliases should work
// Integration Test: Advanced SELECT features
// Tests for SELECT *, aliases, qualified tables

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text, email text);`)
	.database()
// ✅ SUCCESS: column aliases should work

const _result = await _db.query(`select id as user_id, name as user_name from users;`)

expectType<typeof _result>(
	toBe<
		{
			user_id: string | null
			user_name: string | null
		}[]
	>(),
)
