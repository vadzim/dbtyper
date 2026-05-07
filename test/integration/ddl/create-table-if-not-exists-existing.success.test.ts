// Integration Test: CREATE TABLE IF NOT EXISTS (existing table, no-op)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: CREATE TABLE IF NOT EXISTS (existing table, no-op)

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id uuid not null, name text);`)
	.apply(`create table if not exists users (id text);`)
