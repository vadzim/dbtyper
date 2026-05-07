// Integration Test: _db․query() accepts non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ✅ DELETE without RETURNING should be accepted by query()

const _result = await _db.query(`delete from users where id = '1';`)

// Result type should be unknown

type _check = Expect<Matches<typeof _result, unknown>>
