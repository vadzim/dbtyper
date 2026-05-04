// Integration Test: DELETE statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDelete() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ❌ ERROR: DELETE from invalid table
	const bad1 = await db.query(
		// @ts-expect-error
		`delete from invalid_table;`,
	)

	// ❌ ERROR: RETURNING with invalid column
	const bad2 = await db.query(
		// @ts-expect-error
		`delete from users returning invalid_column;`,
	)

	return {}
}

export { testDelete }
