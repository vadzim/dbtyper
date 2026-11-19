// CORE-13: no rows, so the result is an empty row list
// Integration Test: UPDATE without RETURNING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()
// ✅ SUCCESS: UPDATE without RETURNING

const _result = await _db.query(`update users set name = 'Bob' where id = '1';`)

expectType<typeof _result>(toBe<[]>())
