// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdateUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown column in SET
	const bad = await db.query(
		// @ts-expect-error
		`update users set invalid_column = 'value' where id = '1' returning *;`,
	)

	return bad
}

testUpdateUnknownColumn()
