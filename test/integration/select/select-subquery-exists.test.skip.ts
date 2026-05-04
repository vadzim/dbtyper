// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testSelectSubqueryExists() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: subquery with EXISTS
	const result = await db.query(
		`select * from users where exists (select 1 from posts where posts.user_id = users.id);`,
	)

	return result
}

testSelectSubqueryExists()
