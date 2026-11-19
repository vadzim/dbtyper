// Integration Test: DML-9 valid UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null);`)
	.database()

// ✅ SUCCESS: DML-9 valid UPDATE
const _result = await _db.query(`update users set name = 'Bob' where id = '1';`)

expectType<typeof _result>(toBe<[]>())
