// Integration Test: TRUNCATE without RETURNING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testTruncateWithoutReturning() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: TRUNCATE without RETURNING
	const result = await db.query(`truncate table users;`)

	return result
}

testTruncateWithoutReturning()
