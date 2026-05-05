// Integration Test: db․query() accepts non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ DELETE with RETURNING should return typed array
	const result = await db.query(`delete from users where id = '1' returning id, name;`)

	// Result type should be Array<{ id: string; name: string }>
	type ResultType = typeof result
	type _check = ResultType extends Array<{ id: string; name: string }> ? true : false

	return result
}

test()
