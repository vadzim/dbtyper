// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	// ✅ SUCCESS: mixed types in one table
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table mixed_types (
				id serial not null,
				created timestamptz not null,
				data bytea not null,
				duration interval not null,
				ip inet not null
			);`,
		)
		.database()
	const result = await db.query(`select id, created, data, duration, ip from mixed_types;`)

	return result
}

test()
