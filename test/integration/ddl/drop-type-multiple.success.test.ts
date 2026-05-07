// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: DROP multiple types

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active', 'inactive');`)
	.apply(`create type priority as enum ('low', 'high');`)
	.apply(`drop type status;`)
	.apply(`drop type priority;`)
