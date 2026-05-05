// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: ALTER TYPE IF EXISTS (non-existing type, no-op)
sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`alter type if exists missing add value 'new';`)
	.database()
