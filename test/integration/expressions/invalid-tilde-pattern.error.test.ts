// Integration Test: INVALID_TILDE_PATTERN (2115)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (name text);`)
	.database()

// @ts-expect-error: Invalid ~ pattern
const _result = await _db.query(`select * from users where name ~ 123;`)
