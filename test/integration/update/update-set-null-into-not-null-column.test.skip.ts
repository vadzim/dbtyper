// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdateSetNullIntoNotNullColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, name text);`)
		.database()

	// ❌ ERROR: SET NULL into NOT NULL column
	const bad = await db.query(
		// @ts-expect-error
		`update users set id = null where name = 'Alice' returning *;`,
	)

	return bad
}

testUpdateSetNullIntoNotNullColumn()
