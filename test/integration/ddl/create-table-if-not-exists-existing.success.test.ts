// Integration Test: CREATE TABLE IF NOT EXISTS (existing table, no-op)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: CREATE TABLE IF NOT EXISTS (existing table, no-op)

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id uuid not null, name text);`)
	.apply(`create table if not exists users (id text);`)
