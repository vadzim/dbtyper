// Integration Test: JOIN smoke tests - INNER JOIN
// Integration Test: JOIN statements
// Minimal tests demonstrating API functionality

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
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ✅ SUCCESS: INNER JOIN
	const result = await db.query(
		`select users.name, posts.title from users inner join posts on users.id = posts.user_id;`,
	)

	return result
}

test()
