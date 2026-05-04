// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertNullIntoNullableColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: NULL into nullable column
	const result = await db.query(`insert into users (id, name) values ('1', null) returning *;`)

	return result
}

testInsertNullIntoNullableColumn()
