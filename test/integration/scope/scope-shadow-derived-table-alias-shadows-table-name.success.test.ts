// Integration Test: Scope shadowing - Derived table alias shadows table name
// Integration Test: Scope Shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text);`)
	.database()
// ✅ SUCCESS: Derived table alias shadows table name
const result = await db.query(`
		select posts.derived_col 
		from (select 'test' as derived_col from users) as posts;
	`)
type _check = Expect<Matches<typeof result, { derived_col: string }[]>>
