// Integration Test: INVALID_TABLE_IN_UPDATE_FROM (2103)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid table in UPDATE FROM
const _result = await _db.query(`update users set id = 1 from (select * from users where id > 10) as subq;`)
