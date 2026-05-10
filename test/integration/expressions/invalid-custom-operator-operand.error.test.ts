// Integration Test: INVALID_CUSTOM_OPERATOR_OPERAND (2113)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid custom operator operand
const _result = await _db.query(`select * from users where (select * from users) operator(pg_catalog.=) 1;`)
