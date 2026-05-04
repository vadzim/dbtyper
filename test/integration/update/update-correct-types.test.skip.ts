// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdateCorrectTypes() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer, active boolean);`)
		.database()

	// ✅ SUCCESS: correct types
	const result = await db.query(`update users set age = 30, active = false where id = '1' returning *;`)

	return result
}

testUpdateCorrectTypes()
