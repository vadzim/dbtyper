// Integration Test: INSERT statements
// Мінімальныя тэсты, якія дэманструюць працу API

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testInsert() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ❌ ERROR: Няправільная назва калонкі
	const bad1 = await db.query(
		// @ts-expect-error
		`insert into users (id, invalid_column) values (null, null);`,
	)

	// ❌ ERROR: Няправільная назва табліцы
	const bad2 = await db.query(
		// @ts-expect-error
		`insert into invalid_table (id) values (null);`,
	)

	// ❌ ERROR: RETURNING з няправільнай калонкай
	const bad3 = await db.query(
		// @ts-expect-error
		`insert into users (id, name) values (null, null) returning invalid_column;`,
	)

	return {}
}

export { testInsert }
