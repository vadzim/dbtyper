// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: CREATE TYPE with enum values
sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active', 'inactive', 'pending');`)
	.database()
