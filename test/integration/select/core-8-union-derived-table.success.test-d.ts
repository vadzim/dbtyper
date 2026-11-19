// Integration Test: SELECT - CORE-8 a set operation in a derived table
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-8
const _result = await _db.query(`select s.id from (select id from users union all select user_id from posts) s;`)

expectType<typeof _result>(toBe<{ id: number }[]>())
