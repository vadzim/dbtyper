// Integration Test: DROP TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: DROP TYPE IF EXISTS (non-existing type, no-op)

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).apply(`drop type if exists missing;`)
