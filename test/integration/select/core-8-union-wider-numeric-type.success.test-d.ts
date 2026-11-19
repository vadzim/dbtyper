// Integration Test: SELECT - CORE-8 the wider numeric type wins
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-8
const _result = await _db.query(`select score from posts union select id from users;`)

expectType<typeof _result>(toBe<{ score: string | null }[]>())
