// Integration Test: INVALID_ALTER_TABLE_NAME (2107)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid ALTER TABLE name
const _result = _db.apply(`alter table 123invalid add column name text;`)
