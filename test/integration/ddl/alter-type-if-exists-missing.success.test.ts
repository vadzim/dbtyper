// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: ALTER TYPE IF EXISTS (non-existing type, no-op)

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`alter type if exists missing add value 'new';`)
