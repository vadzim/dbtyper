// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ❌ FAILURE: ALTER type from unknown schema

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

migrations.apply(
	// @ts-expect-error
	`alter type ghost.status add value 'new';`,
)
