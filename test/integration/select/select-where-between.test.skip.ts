// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectWhereBetween() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ✅ SUCCESS: WHERE column BETWEEN
	const result = await db.query(`select * from users where age between 18 and 65;`)

	return result
}

testSelectWhereBetween()
