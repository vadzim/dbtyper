// Integration Test: Basic SELECT queries
// Мінімальныя тэсты, якія дэманструюць працу API

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testBasicSelect() {
	const db = await sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, email text);`)
		.database()

	// ✅ SUCCESS: SELECT named columns
	const result1 = await db.query(`select id, name from users;`)

	// ✅ SUCCESS: SELECT *
	const result2 = await db.query(`select * from users;`)

	// ❌ ERROR: няправільная калонка
	// @ts-expect-error
	const bad1 = await db.query(`select wrong_col from users;`)

	return { result1, result2 }
}

export { testBasicSelect }
