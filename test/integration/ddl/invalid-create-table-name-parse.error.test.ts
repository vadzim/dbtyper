// Integration Test: INVALID_CREATE_TABLE_NAME_PARSE (2108)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.database()

// @ts-expect-error: Invalid CREATE TABLE name parse
const _result = _db.apply(`create table 123invalid (id integer);`)
