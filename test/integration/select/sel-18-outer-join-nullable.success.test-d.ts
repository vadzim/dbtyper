// Integration Test: SELECT - SEL-18 columns of the optional side of an outer join are nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-18 right side of LEFT is nullable
const _left = await _db.query(
	`select users.name, orders.total from users left join orders on users.id = orders.user_id;`,
)
expectType<typeof _left>(toBe<{ name: string; total: number | null }[]>())

// ✅ SUCCESS: SEL-18 left side of RIGHT is nullable
const _right = await _db.query(
	`select users.name, orders.total from users right join orders on users.id = orders.user_id;`,
)
expectType<typeof _right>(toBe<{ name: string | null; total: number }[]>())

// ✅ SUCCESS: SEL-18 both sides of FULL are nullable
const _full = await _db.query(
	`select users.name, orders.total from users full join orders on users.id = orders.user_id;`,
)
expectType<typeof _full>(toBe<{ name: string | null; total: number | null }[]>())

// ✅ SUCCESS: SEL-18 an inner join keeps both sides non-null
const _inner = await _db.query(
	`select users.name, orders.total from users inner join orders on users.id = orders.user_id;`,
)
expectType<typeof _inner>(toBe<{ name: string; total: number }[]>())
