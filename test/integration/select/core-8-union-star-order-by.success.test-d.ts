// Integration Test: SELECT - CORE-8 select * arms, ORDER BY and LIMIT after the last arm
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-8
const _result = await _db.query(`select * from users union select * from users order by id limit 5;`)

expectType<typeof _result>(toBe<{ id: number; name: string | null }[]>())
