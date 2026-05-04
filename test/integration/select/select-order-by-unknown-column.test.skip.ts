// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectOrderByUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: ORDER BY unknown column
	const bad = await db.query(
		// @ts-expect-error
		`select * from users order by invalid_column;`,
	)

	return bad
}

testSelectOrderByUnknownColumn()
