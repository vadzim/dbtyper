// Integration Test: Scope shadowing - CTE shadows table with same name
// Integration Test: Scope Shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: CTE shadows table with same name

const _result = await _db.query(`
		with users as (select id from posts)
		select id from users;
	`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string
		}>
	>(),
)
