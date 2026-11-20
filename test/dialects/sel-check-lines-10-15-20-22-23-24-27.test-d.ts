// Integration Test: SEL-10, SEL-15, SEL-20, SEL-22, SEL-23, SEL-24, SEL-27 Checks (verification/select.md @ 2a941c8)
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

type Code<E> = E extends { __sql_parser_error_code__: infer C } ? C : never
const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null);
		 create table orders (id integer not null, user_id integer not null, total integer not null);
		 create table posts (id integer not null, user_id integer not null, title text);
		 create table roles (role_name text not null);
		 create table tags (id text not null, label text not null);`,
	)
	.database()

// SEL-10
const _sel10 = await db.query(`select posts.id from users as posts;`)
expectType<typeof _sel10>(toBe<{ id: number }[]>())
const q10 = `select users.id from users u;` as const
// @ts-expect-error
await db.query(q10)
expectType<GetQueryError<typeof db, typeof q10>>(toBe<DbtyperError<2307, "Unknown qualified column users.id">>())

// SEL-15
const _sel15 = await db.query(
	`select u1.name as employee, u2.name as manager from users u1 left join users u2 on u1.id = u2.id;`,
)
expectType<typeof _sel15>(toBe<{ employee: string; manager: string | null }[]>())
const _sel15b = await db.query(`select users.name, roles.role_name from users cross join roles;`)
expectType<typeof _sel15b>(toBe<{ name: string; role_name: string }[]>())

// SEL-20
const _sel20 = await db.query(`with users as (select id from posts) select id from users;`)
expectType<typeof _sel20>(toBe<{ id: number }[]>())
const q20a = `with x as (select id from users), x as (select id from users) select id from x;` as const
// @ts-expect-error
await db.query(q20a)
expectType<Code<GetQueryError<typeof db, typeof q20a>>>(toBe<3210>())
const q20b = `with a as (select ghost from users) select * from a;` as const
// @ts-expect-error
await db.query(q20b)
expectType<Code<GetQueryError<typeof db, typeof q20b>>>(toBe<2300>())

// SEL-22
const _sel22 = await db.query(`select id, (select count(*) from orders) as n from users;`)
expectType<typeof _sel22>(toBe<{ id: number; n: string | null }[]>())
const q22a = `select (select id, name from users) as x from users;` as const
// @ts-expect-error
await db.query(q22a)
expectType<Code<GetQueryError<typeof db, typeof q22a>>>(toBe<3100>())
// SEL-22 `name in (select user_id from posts)` → 2504 per the Check, the code gives 2505: SPEC-Q, see sel-22-check-in-subquery-code.test-d.skip.ts

// SEL-23
const _sel23 = await db.query(
	`select * from users u where u.id in (select user_id from orders where orders.total > u.id);`,
)
expectType<typeof _sel23>(toBe<{ id: number; name: string }[]>())
const _sel23b = await db.query(`select u.id from users u where exists (select 1 from users where users.id = u.id);`)
expectType<typeof _sel23b>(toBe<{ id: number }[]>())

// SEL-24: the inner `id` is tags.id (text)
const _sel24 = await db.query(`select id from users where exists (select 1 from tags where label = id);`)
expectType<typeof _sel24>(toBe<{ id: number }[]>())

// SEL-27
const _sel27 = await db.query(`select user_id, count(*) as post_count from posts group by user_id;`)
expectType<typeof _sel27>(toBe<{ user_id: number; post_count: string }[]>())
const q27a = `select user_id, title from posts group by user_id;` as const
// @ts-expect-error
await db.query(q27a)
expectType<Code<GetQueryError<typeof db, typeof q27a>>>(toBe<3403>())
const q27b = `select name, count(*) as c from users;` as const
// @ts-expect-error
await db.query(q27b)
expectType<Code<GetQueryError<typeof db, typeof q27b>>>(toBe<3403>())
