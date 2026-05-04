// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDeleteReturningUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: RETURNING unknown column
	const bad = await db.query(
		// @ts-expect-error
		`delete from users where id = '1' returning invalid_column;`,
	)

	return bad
}

testDeleteReturningUnknownColumn()
