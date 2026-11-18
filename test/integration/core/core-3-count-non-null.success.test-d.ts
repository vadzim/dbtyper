// Integration Test: CORE-3: count is non-null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-3: count is non-null
const _result = await _db.query(`select count(*) as c, count(email) as d from users;`)

expectType<typeof _result>(toBe<{ c: string; d: string }[]>())
