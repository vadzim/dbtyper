// Integration Test: INVALID_CASE_BRANCH (2015)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid CASE branch
const _result = await _db.query(`select case when (select * from users) then 'yes' end as result from users;`)
