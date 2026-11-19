// Integration Test: Scope shadowing - Table alias shadows table name
// Integration Test: Scope Shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: Table alias shadows table name

const _result = await _db.query(`
		select posts.id from users as posts;
	`)

expectType<typeof _result>(
	toBe<
		Array<{
			id: string | null
		}>
	>(),
)
