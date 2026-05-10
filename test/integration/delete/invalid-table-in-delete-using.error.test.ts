// Integration Test: INVALID_TABLE_IN_DELETE_USING (2104)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid table in DELETE USING
const _result = await _db.query(`delete from users using (select * from users where id > 10) as subq;`)
