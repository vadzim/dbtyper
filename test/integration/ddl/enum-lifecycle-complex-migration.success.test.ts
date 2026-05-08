// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: Complex migration scenario

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type old_status as enum ('active', 'inactive');`)
	.apply(`create type new_status as enum ('enabled', 'disabled');`)
	.apply(`alter type new_status add value 'pending';`)
	.apply(`drop type old_status;`)
	.apply(`create type status as enum ('live', 'archived');`)
