// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdateMultipleColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: UPDATE multiple columns
	const result = await db.query(
		`update users set name = 'Alice', email = 'alice@example.com' where id = '1' returning *;`,
	)

	return result
}

testUpdateMultipleColumns()
