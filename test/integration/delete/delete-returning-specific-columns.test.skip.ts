// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDeleteReturningSpecificColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: RETURNING specific columns
	const result = await db.query(`delete from users where id = '1' returning id, name;`)

	// Type should be: Array<{ id: string; name: string }>
	const _typeCheck: typeof result = [] as Array<{
		id: string
		name: string
	}>

	return result
}

testDeleteReturningSpecificColumns()
