// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectHaving() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: HAVING clause
	const result = await db.query(`select user_id, count(*) as count from posts group by user_id having count(*) > 5;`)

	return result
}

testSelectHaving()
