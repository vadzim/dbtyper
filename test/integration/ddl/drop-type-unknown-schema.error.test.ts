// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ❌ FAILURE: DROP type from unknown schema

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

migrations.apply(
	// @ts-expect-error
	`drop type ghost.status;`,
)
