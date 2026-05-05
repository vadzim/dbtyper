// Integration Test: SELECT with CASE WHEN (searched form) - Boolean THEN with integer ELSE
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

	// ❌ ERROR: Boolean THEN with integer ELSE
	const result = await db.query(
		// @ts-expect-error
		`select case when active then true else 0 end from users;`,
	)

	return result
}

test()
