// Integration Test: Scope shadowing - CTE shadows table with same name
// Integration Test: Scope Shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: CTE shadows table with same name
const result = await db.query(`
		with users as (select id from posts)
		select id from users;
	`)
type _check = Expect<Matches<typeof result, Array<{ id: string }>>>
