// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown column
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (id, invalid_column) values ('1', 'value') returning *;`,
	)

	return bad
}

testInsertUnknownColumn()
