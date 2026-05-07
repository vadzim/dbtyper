// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: ALTER TYPE ADD VALUE to existing enum

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active', 'inactive');`)
	.apply(`alter type status add value 'pending';`)
