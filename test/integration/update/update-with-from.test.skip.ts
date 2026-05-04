// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testUpdateWithFrom() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ✅ SUCCESS: UPDATE with FROM clause
	const result = await db.query(
		`update users set name = 'Author' from posts where users.id = posts.user_id returning users.*;`,
	)

	return result
}

testUpdateWithFrom()
