// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: IF NOT EXISTS and IF EXISTS combinations

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type if not exists status as enum ('active', 'inactive');`)
	.apply(`create type if not exists status as enum ('new');`)
	.apply(`alter type if exists status add value 'pending';`)
	.apply(`alter type if exists missing add value 'value';`)
	.apply(`drop type if exists status;`)
	.apply(`drop type if exists missing;`)
