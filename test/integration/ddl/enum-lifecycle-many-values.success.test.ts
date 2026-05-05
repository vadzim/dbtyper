// Integration Test: Full enum type lifecycle (CREATE, ALTER, DROP)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

// ✅ SUCCESS: Enum with many values
const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type day_of_week as enum ('monday', 'tuesday', 'wednesday');`)
	.apply(`alter type day_of_week add value 'thursday';`)
	.apply(`alter type day_of_week add value 'friday';`)
	.apply(`alter type day_of_week add value 'saturday';`)
	.apply(`alter type day_of_week add value 'sunday';`)
	.database()
