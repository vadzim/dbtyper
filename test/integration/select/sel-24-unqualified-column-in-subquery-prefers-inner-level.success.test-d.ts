// Integration Test: SELECT - SEL-24 unqualified column in a subquery resolves at the innermost level first
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-24 unqualified column in a subquery resolves at the innermost level first
const _result = await _db.query(`select id from users where exists (select 1 from orders where user_id = id);`)

expectType<typeof _result>(toBe<{ id: number }[]>())
