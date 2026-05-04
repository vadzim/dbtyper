// Integration Test: DELETE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testDeleteWithComplexWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, age integer);`)
		.database()

	// ✅ SUCCESS: DELETE with complex WHERE
	const result = await db.query(`delete from users where age < 18 or name is null returning *;`)

	return result
}

testDeleteWithComplexWhere()
