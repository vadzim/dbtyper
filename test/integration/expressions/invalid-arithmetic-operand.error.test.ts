// Integration Test: INVALID_ARITHMETIC_OPERAND (2003)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (name text);`)
	.database()

// @ts-expect-error: Invalid arithmetic operand
const _result = await _db.query(`select name + 5 as result from users;`)
