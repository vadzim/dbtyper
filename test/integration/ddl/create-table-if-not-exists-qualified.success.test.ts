// Integration Test: CREATE TABLE IF NOT EXISTS with qualified name (existing table, no-op)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: CREATE TABLE IF NOT EXISTS with schema.table (existing table, no-op)

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema auth;`)
	.apply(`create table auth.users (id uuid not null);`)
	.apply(`create table if not exists auth.users (id text not null);`)
