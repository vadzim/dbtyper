// Integration Test: INVALID_PRECISION_NUMBER (2118)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.database()

// @ts-expect-error: Invalid precision number
const _result = _db.apply(`create table users (price numeric('invalid', 2));`)
