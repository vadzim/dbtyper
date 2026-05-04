// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectCTEInJoin() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text not null);`)
		.apply(`create table posts (id text not null, user_id text not null);`)
		.database()

	// ✅ SUCCESS: CTE in JOIN with type checking
	const result = await db.query(
		`with active_users as (
       select id, name from users
     )
     select active_users.name, posts.id 
     from active_users 
     left join posts on active_users.id = posts.user_id;`,
	)

	return result
}

testSelectCTEInJoin()
