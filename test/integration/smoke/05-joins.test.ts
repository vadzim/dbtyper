// Integration Test: JOIN statements
// Мінімальныя тэсты, якія дэманструюць працу API

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testJoins() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ✅ SUCCESS: INNER JOIN
	const result1 = await db.query(
		`select users.name, posts.title from users inner join posts on users.id = posts.user_id;`,
	)

	// ✅ SUCCESS: LEFT JOIN
	const result2 = await db.query(
		`select users.name, posts.title from users left join posts on users.id = posts.user_id;`,
	)

	return { result1, result2 }
}

export { testJoins }
