// Integration Test: INVALID_LIKE_OPERAND (2006)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid LIKE operand
const _result = await _db.query(`select * from users where id like '%test%';`)
