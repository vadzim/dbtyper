// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: Drop schema with types

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema temp;`)
	.apply(`create type temp.status as enum ('active', 'inactive');`)
	.apply(`drop type temp.status;`)
	.apply(`drop schema temp;`)
