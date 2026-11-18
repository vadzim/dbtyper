// Integration Test: SELECT - SEL-18 INNER join
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-18 inner join keeps both sides non-null
const _result = await _db.query(
	`select users.name, orders.total from users inner join orders on users.id = orders.user_id;`,
)

expectType<typeof _result>(toBe<{ name: string; total: number }[]>())
