// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ❌ FAILURE: DROP non-existing type

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

migrations.apply(
	// @ts-expect-error
	`drop type missing;`,
)
