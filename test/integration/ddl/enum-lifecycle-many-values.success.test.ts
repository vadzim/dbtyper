// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: Enum with many values

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type day_of_week as enum ('monday', 'tuesday', 'wednesday');`)
	.apply(`alter type day_of_week add value 'thursday';`)
	.apply(`alter type day_of_week add value 'friday';`)
	.apply(`alter type day_of_week add value 'saturday';`)
	.apply(`alter type day_of_week add value 'sunday';`)
