// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	// ✅ SUCCESS: tsvector and tsquery (full-text search)
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table documents (id integer not null, search_vector tsvector not null, search_query tsquery not null);`,
		)
		.database()
	const result = await db.query(`select id, search_vector, search_query from documents;`)

	return result
}

test()
