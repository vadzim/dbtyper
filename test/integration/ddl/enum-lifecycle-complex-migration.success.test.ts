// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: Complex migration scenario
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type old_status as enum ('active', 'inactive');`)
	.apply(`create type new_status as enum ('enabled', 'disabled');`)
	.apply(`alter type new_status add value 'pending';`)
	.apply(`drop type old_status;`)
	.apply(`create type status as enum ('live', 'archived');`)
	.database()
