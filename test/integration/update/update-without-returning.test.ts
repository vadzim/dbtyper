// Integration Test: UPDATE without RETURNING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testUpdateWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: UPDATE without RETURNING
	const result = await db.query(`update users set name = 'Bob' where id = '1';`)

	return result
}

testUpdateWithoutReturning()
