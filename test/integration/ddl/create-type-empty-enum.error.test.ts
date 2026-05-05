// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ❌ FAILURE: Empty enum values
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		// @ts-expect-error
		`create type empty as enum ();`,
	)
	.database()
