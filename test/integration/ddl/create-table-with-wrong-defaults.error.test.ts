// Integration Test: CREATE TABLE with DEFAULT values
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ❌ ERROR: CREATE TABLE with wrong DEFAULT values should throw an error
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		// @ts-expect-error
		`create table users (
				id text not null,
				name text not null,
				email text,
				age numeric default 'xxx',
				active boolean default true,
				created_at timestamp default now()
			);`,
	)
	.database()
