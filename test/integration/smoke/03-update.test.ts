// Integration Test: UPDATE statements
// Мінімальныя тэсты, якія дэманструюць працу API

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testUpdate() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ❌ ERROR: UPDATE няправільнай калонкі
	// @ts-expect-error
	const bad1 = await db.query(`update users set invalid_column = null;`)

	// ❌ ERROR: UPDATE няправільнай табліцы
	// @ts-expect-error
	const bad2 = await db.query(`update invalid_table set name = null;`)

	// ❌ ERROR: RETURNING з няправільнай калонкай
	// @ts-expect-error
	const bad3 = await db.query(`update users set name = null returning invalid_column;`)

	return {}
}

export { testUpdate }
