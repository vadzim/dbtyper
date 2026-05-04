// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdateWhereTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ❌ ERROR: WHERE clause type mismatch
	const bad = await db.query(
		// @ts-expect-error
		`update users set name = 'Alice' where age = 'not a number' returning *;`,
	)

	return bad
}

testUpdateWhereTypeMismatch()
