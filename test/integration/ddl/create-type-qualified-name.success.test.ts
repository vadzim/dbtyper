// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: Qualified type name with schema
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema app;`)
	.apply(`create type app.status as enum ('active', 'inactive');`)
	.database()
