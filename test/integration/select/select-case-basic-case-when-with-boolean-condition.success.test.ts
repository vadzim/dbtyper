// Integration Test: SELECT with CASE WHEN (searched form) - Basic CASE WHEN with boolean condition
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function test() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(
			`create table users (
				id text not null,
				name text not null,
				age integer not null,
				active boolean not null
			);`,
		)
		.database()


	// ✅ SUCCESS: Basic CASE WHEN with boolean condition
	const result = await db.query(`
		select
			name,
			case
				when age >= 18 then 'adult'
				else 'minor'
			end as category
		from users;
	`)

	return result
}

test()
