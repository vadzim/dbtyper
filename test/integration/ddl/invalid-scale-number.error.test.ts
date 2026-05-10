// Integration Test: INVALID_SCALE_NUMBER (2119)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.database()

// @ts-expect-error: Invalid scale number
const _result = _db.apply(`create table users (price numeric(10, 'invalid'));`)
