// Integration Test: SELECT - CORE-11 an alias resolves a duplicate output name
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-11
const _result = await _db.query(
	`select users.id, posts.id as post_id from users join posts on posts.user_id = users.id;`,
)

expectType<typeof _result>(toBe<{ id: number; post_id: number }[]>())
