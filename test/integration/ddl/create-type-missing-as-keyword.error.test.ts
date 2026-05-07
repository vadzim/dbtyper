// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ❌ FAILURE: Missing AS keyword

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

migrations.apply(
	// @ts-expect-error
	`create type status enum ('active');`,
)
