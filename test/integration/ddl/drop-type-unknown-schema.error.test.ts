// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ❌ FAILURE: DROP type from unknown schema
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		// @ts-expect-error
		`drop type ghost.status;`,
	)
	.database()
