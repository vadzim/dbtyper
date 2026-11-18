// Integration Test: PARAM-8 - select item starting with a named parameter followed by an operator
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()

// ✅ SUCCESS: PARAM-8
const _result = await _db.query(`select :x + 1 as a from users;`, { x: 1 })

expectType<typeof _result>(toBe<Array<{ a: number }>>())
