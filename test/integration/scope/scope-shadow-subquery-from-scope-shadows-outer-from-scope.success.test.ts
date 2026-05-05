// Integration Test: Scope shadowing - Subquery FROM scope shadows outer FROM scope
// Integration Test: Scope Shadowing
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()


	// ✅ SUCCESS: Subquery FROM scope shadows outer FROM scope
	const result = await db.query(`
		select 
			(select posts.id from users as posts) as inner_id,
			posts.user_id as outer_user_id
		from posts;
	`)

	return result
}

test()
