// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdateWithComplexWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, age integer);`)
		.database()

	// ✅ SUCCESS: UPDATE with complex WHERE
	const result = await db.query(`update users set name = 'Adult' where age >= 18 returning *;`)

	return result
}

testUpdateWithComplexWhere()
