// Integration Test: CREATE TABLE IF NOT EXISTS with qualified name (existing table, no-op)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: CREATE TABLE IF NOT EXISTS with schema.table (existing table, no-op)

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema auth;`)
	.apply(`create table auth.users (id uuid not null);`)
	.apply(`create table if not exists auth.users (id text not null);`)
