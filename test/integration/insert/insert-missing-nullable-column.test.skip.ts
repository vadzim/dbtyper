// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertMissingNullableColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: missing nullable column (implicitly NULL)
	const result = await db.query(`insert into users (id) values ('1') returning *;`)

	return result
}

testInsertMissingNullableColumn()
