// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectCTEInJoin() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: CTE used in JOIN
	const result = await db.query(
		`with post_counts as (
       select user_id, count(*) as count from posts group by user_id
     )
     select users.name, post_counts.count 
     from users 
     left join post_counts on users.id = post_counts.user_id;`,
	)

	return result
}

testSelectCTEInJoin()
