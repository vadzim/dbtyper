// Integration Test: SELECT || concatenation success
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id uuid, name text, age integer, score numeric, active boolean);`)
	.database()

// ✅ text || numeric → text
const _result = await _db.query(`select 'Score: ' || 123.456 as message from users;`)
type _check = Expect<Matches<typeof _result, Array<{ message: string }>>>
