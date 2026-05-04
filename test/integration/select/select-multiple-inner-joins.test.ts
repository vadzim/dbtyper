// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectMultipleInnerJoins() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.apply(`create table comments (id text, post_id text, content text);`)
		.database()

	// ✅ SUCCESS: multiple INNER JOINs
	const result = await db.query(
		`select users.name, posts.title, comments.content 
     from users 
     inner join posts on users.id = posts.user_id 
     inner join comments on posts.id = comments.post_id;`,
	)

	return result
}

testSelectMultipleInnerJoins()
