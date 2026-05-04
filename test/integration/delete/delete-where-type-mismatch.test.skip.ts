// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDeleteWhereTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ❌ ERROR: WHERE clause type mismatch
	const bad = await db.query(
		// @ts-expect-error
		`delete from users where age = 'not a number' returning *;`,
	)

	return bad
}

testDeleteWhereTypeMismatch()
