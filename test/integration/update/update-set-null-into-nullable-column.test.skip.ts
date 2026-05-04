// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdateSetNullIntoNullableColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: SET NULL into nullable column
	const result = await db.query(`update users set name = null where id = '1' returning *;`)

	return result
}

testUpdateSetNullIntoNullableColumn()
