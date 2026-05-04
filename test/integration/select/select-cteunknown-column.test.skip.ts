// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectCTEUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: reference unknown column from CTE
	const bad = await db.query(
		// @ts-expect-error
		`with active_users as (select id, name from users) 
     select invalid_column from active_users;`,
	)

	return bad
}

testSelectCTEUnknownColumn()
