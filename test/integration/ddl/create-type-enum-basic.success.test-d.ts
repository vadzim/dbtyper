// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// PGT-13: CREATE TYPE ... AS ENUM
// ✅ SUCCESS: CREATE TYPE with enum values

const _db = sqlMigrations({ driver: mockDriver }).apply(`create type status as enum ('active', 'inactive', 'pending');`)
