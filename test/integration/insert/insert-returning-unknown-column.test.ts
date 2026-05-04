// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsertReturningUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: RETURNING unknown column
	const bad = await db.query(
		// @ts-expect-error
		`insert into users (id, name) values ('1', 'Alice') returning invalid_column;`,
	)

	return bad
}

testInsertReturningUnknownColumn()
