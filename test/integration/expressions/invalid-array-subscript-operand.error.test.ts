// Integration Test: INVALID_ARRAY_SUBSCRIPT_OPERAND (2028)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (tags text[]);`)
	.database()

// @ts-expect-error: Invalid array subscript operand
const _result = await _db.query(`select tags[(select * from users)] as result from users;`)
