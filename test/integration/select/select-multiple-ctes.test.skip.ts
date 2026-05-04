// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectMultipleCTEs() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: multiple CTEs
	const result = await db.query(
		`with 
       active_users as (select * from users where id is not null),
       user_posts as (select * from posts where user_id is not null)
     select * from active_users 
     inner join user_posts on active_users.id = user_posts.user_id;`,
	)

	return result
}

testSelectMultipleCTEs()
