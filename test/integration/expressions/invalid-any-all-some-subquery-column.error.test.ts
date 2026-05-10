// Integration Test: INVALID_ANY_ALL_SOME_SUBQUERY_COLUMN (2026)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer);`)
	.database()

// @ts-expect-error: Invalid ANY/ALL/SOME subquery column
const _result = await _db.query(`select * from users where 1 > any((select * from users));`)
