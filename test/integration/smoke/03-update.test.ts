// Integration Test: UPDATE statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdate() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ❌ ERROR: UPDATE invalid column
	const bad1 = await db.query(
		// @ts-expect-error
		`update users set invalid_column = null;`,
	)

	// ❌ ERROR: UPDATE invalid table
	const bad2 = await db.query(
		// @ts-expect-error
		`update invalid_table set name = null;`,
	)

	// ❌ ERROR: RETURNING with invalid column
	const bad3 = await db.query(
		// @ts-expect-error
		`update users set name = null returning invalid_column;`,
	)

	return {}
}

export { testUpdate }
