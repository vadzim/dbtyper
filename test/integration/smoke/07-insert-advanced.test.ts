// Integration Test: Advanced INSERT features
// Tests for missing required columns

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertMissingRequiredColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text);`)
		.database()

	// ❌ ERROR: missing required column 'id'
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (name) values ('Alice') returning *;`,
	)

	return bad
}

testInsertMissingRequiredColumn()
