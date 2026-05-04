// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

async function testSelectCrossJoin() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table roles (id text, role_name text);`)
		.database()

	// ✅ SUCCESS: CROSS JOIN (Cartesian product)
	const result = await db.query(`select users.name, roles.role_name from users cross join roles;`)

	return result
}

testSelectCrossJoin()
