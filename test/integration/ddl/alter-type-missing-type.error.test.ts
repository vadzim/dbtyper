// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ❌ FAILURE: ALTER non-existing type
sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		// @ts-expect-error
		`alter type missing add value 'new';`,
	)
	.database()
