// Integration Test: SELECT - CORE-10 several conditions, LIKE and an unqualified column in ON
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-10
const _result = await _db.query(
	`select u.id from users u join posts p on p.user_id = u.id and p.title like 'a%' and name <> 'x';`,
)

expectType<typeof _result>(toBe<{ id: number }[]>())
