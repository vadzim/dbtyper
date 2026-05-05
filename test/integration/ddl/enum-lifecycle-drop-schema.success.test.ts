// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: Drop schema with types
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema temp;`)
	.apply(`create type temp.status as enum ('active', 'inactive');`)
	.apply(`drop type temp.status;`)
	.apply(`drop schema temp;`)
	.database()
