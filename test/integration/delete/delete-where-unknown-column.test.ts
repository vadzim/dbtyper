// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDeleteWhereUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: unknown column in WHERE
	const bad = await db.query(
		// @ts-expect-error
		`delete from users where invalid_column = '1' returning *;`,
	)

	return bad
}

testDeleteWhereUnknownColumn()
