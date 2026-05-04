// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectGroupByMultipleColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text, category text);`)
		.database()

	// ✅ SUCCESS: GROUP BY multiple columns
	const result = await db.query(`select user_id, category, count(*) as count from posts group by user_id, category;`)

	return result
}

testSelectGroupByMultipleColumns()
