// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: Multiple enum types with different lifecycles

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active', 'inactive');`)
	.apply(`create type priority as enum ('low', 'high');`)
	.apply(`alter type status add value 'pending';`)
	.apply(`alter type priority add value 'medium';`)
	.apply(`drop type status;`)
	.apply(`create type status as enum ('new', 'old');`)
