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
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// Feature not implemented: Type compatibility checking in JOIN ON with CTEs
	// Parser reports "Incompatible types in JOIN ON" for text = text comparison
	// This appears to be a bug in type resolution for CTE columns in JOIN conditions
	const result = await db.query(
		`with active_users as (
       select id, name from users where id is not null
     )
     select active_users.name, posts.id 
     from active_users 
     left join posts on active_users.id = posts.user_id;`,
	)

	return result
}

testSelectCTEInJoin()
