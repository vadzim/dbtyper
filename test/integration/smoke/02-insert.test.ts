// Integration Test: INSERT statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsert() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ❌ ERROR: Invalid column name
	const bad1 = await db.query(
		// @ts-expect-error
		`insert into users (id, invalid_column) values (null, null);`,
	)

	// ❌ ERROR: Invalid table name
	const bad2 = await db.query(
		// @ts-expect-error
		`insert into invalid_table (id) values (null);`,
	)

	// ❌ ERROR: RETURNING with invalid column
	const bad3 = await db.query(
		// @ts-expect-error
		`insert into users (id, name) values (null, null) returning invalid_column;`,
	)

	return {}
}

export { testInsert }
