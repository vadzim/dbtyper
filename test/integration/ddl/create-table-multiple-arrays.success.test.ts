// Integration Test: CREATE TABLE with array types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	// ✅ SUCCESS: multiple array columns
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table multi (id integer not null, tags text[] not null, scores integer[] not null, flags boolean[] not null);`,
		)
		.database()
	const result = await db.query(`select id, tags, scores, flags from multi;`)

	return result
}

test()
