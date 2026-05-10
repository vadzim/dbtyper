// Integration Test: INVALID_CASE_ELSE (2017)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid CASE ELSE
const _result = await _db.query(`select case when id > 0 then 'yes' else (select * from users) end as result from users;`)
