// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertMultipleRows() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: INSERT multiple rows
	const result = await db.query(
		`insert into users (id, name) values ('1', 'Alice'), ('2', 'Bob'), ('3', 'Charlie') returning *;`,
	)

	return result
}

testInsertMultipleRows()
