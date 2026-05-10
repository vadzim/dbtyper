// Integration Test: INVALID_PARAMETER_TYPE_IN_SELECT (2106)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid parameter type in SELECT
const _result = await _db.query(`select $1 as result from users;`, [{ invalid: 'object' }])
