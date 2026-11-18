// Integration Test: SELECT - CORE-12 a CTE may use an earlier CTE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-12
const _result = await _db.query(`with a as (select id from users), b as (select id from a) select id from b;`)

expectType<typeof _result>(toBe<{ id: number }[]>())
