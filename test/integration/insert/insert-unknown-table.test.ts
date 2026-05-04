// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertUnknownTable() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown table
	const bad = await db.query(
		// @ts-expect-error
		`insert into nonexistent (id) values ('1') returning *;`,
	)

	return bad
}

testInsertUnknownTable()
