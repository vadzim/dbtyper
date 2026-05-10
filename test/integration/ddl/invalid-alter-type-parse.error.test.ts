// Integration Test: INVALID_ALTER_TYPE_PARSE (2111)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active', 'inactive');`)
	.database()

// @ts-expect-error: Invalid ALTER TYPE parse
const _result = _db.apply(`alter type 123invalid add value 'pending';`)
