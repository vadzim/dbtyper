// Integration Test: UPDATE without RETURNING
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()
// ✅ SUCCESS: UPDATE without RETURNING

const _result = await _db.query(`update users set name = 'Bob' where id = '1';`)

type _check = Expect<Matches<typeof _result, unknown>>
