// Integration Test: SELECT with CASE WHEN (searched form) - CASE in WHERE must return boolean
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

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

// ❌ ERROR: CASE in WHERE must return boolean
const result = db.query(
	// @ts-expect-error
	`select * from users where case when active then 'yes' else 'no' end;`,
)
