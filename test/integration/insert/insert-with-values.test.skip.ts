// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertWithValues() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: INSERT with VALUES
	const result = await db.query(
		`insert into users (id, name, email) values ('1', 'Alice', 'alice@example.com') returning *;`,
	)

	return result
}

testInsertWithValues()
