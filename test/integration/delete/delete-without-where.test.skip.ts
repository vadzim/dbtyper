// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDeleteWithoutWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: DELETE without WHERE (deletes all rows)
	const result = await db.query(`delete from users returning *;`)

	return result
}

testDeleteWithoutWhere()
