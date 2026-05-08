// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: DROP TYPE with qualified name

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema app;`)
	.apply(`create type app.status as enum ('active', 'inactive');`)
	.apply(`drop type app.status;`)
