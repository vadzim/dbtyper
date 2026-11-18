// Integration Test: SELECT - CORE-8 INTERSECT, EXCEPT and UNION chained
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-8
const _result = await _db.query(
	`select id, name as n from users intersect select user_id, title from posts except select id, title from posts union select id, name from users;`,
)

expectType<typeof _result>(toBe<{ id: number; n: string | null }[]>())
