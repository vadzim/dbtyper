// Integration Test: DELETE statements
// Мінімальныя тэсты, якія дэманструюць працу API

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testDelete() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ❌ ERROR: DELETE з няправільнай табліцы
	const bad1 = await db.query(
		// @ts-expect-error
		`delete from invalid_table;`,
	)

	// ❌ ERROR: RETURNING з няправільнай калонкай
	const bad2 = await db.query(
		// @ts-expect-error
		`delete from users returning invalid_column;`,
	)

	return {}
}

export { testDelete }
