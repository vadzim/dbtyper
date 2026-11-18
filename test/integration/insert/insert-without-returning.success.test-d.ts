// CORE-13: no rows, so the result is an empty row list
// Integration Test: INSERT without RETURNING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()
// ✅ SUCCESS: INSERT without RETURNING

const _result = await _db.query(`insert into users (id, name) values ('1', 'Alice');`)

expectType<typeof _result>(toBe<[]>())
