// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectGroupBySingleColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ✅ SUCCESS: GROUP BY single column
	const result = await db.query(`select user_id, count(*) as post_count from posts group by user_id;`)

	return result
}

testSelectGroupBySingleColumn()
