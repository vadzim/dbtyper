// Spike try/correlated: correlated scalar subqueries in the SELECT list (both dialects), PostgreSQL LATERAL
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver, sqliteMockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
const ddl = `create table users (id integer not null, name text not null); create table orders (id integer not null, user_id integer not null, total integer not null);`
const pg = sqlMigrations({ driver: mockDriver }).apply(ddl).database()
const sl = sqlMigrations({ driver: sqliteMockDriver }).apply(ddl).database()

const a = await pg.query(`select u.id, (select count(*) from orders o where o.user_id = u.id) as n from users u`)
expectType<typeof a>(toBe<{ id: number; n: string | null }[]>())
const b = await sl.query(`select u.id, (select count(*) from orders o where o.user_id = u.id) as n from users u`)
expectType<typeof b>(toBe<{ id: number; n: number | null }[]>())
// unqualified outer column, inner level preferred (SEL-24)
const c = await pg.query(`select u.id, (select max(total) from orders where user_id = id) as m from users u`)
expectType<typeof c>(toBe<{ id: number; m: number | null }[]>())
// nested in an expression
const d = await pg.query(`select coalesce((select max(o.total) from orders o where o.user_id = u.id), 0) as m from users u`)
expectType<typeof d>(toBe<{ m: number }[]>())
// error inside a select-list subquery
const q1 = `select (select o.nope from orders o where o.user_id = u.id) as n from users u` as const
// @ts-expect-error
await pg.query(q1)
expectType<GetQueryError<typeof pg, typeof q1>>(toBe<DbtyperError<2307, "Unknown qualified column o.nope">>())
// more than one column
const q2 = `select (select o.id, o.total from orders o where o.user_id = u.id) as n from users u` as const
// @ts-expect-error
await pg.query(q2)
expectType<GetQueryError<typeof pg, typeof q2>>(toBe<DbtyperError<3100, "Scalar subquery must project exactly one column">>())
// grouped outer query: correlated to a group key
const f = await pg.query(`select u.id, (select count(*) from orders o where o.user_id = u.id) as n from users u group by u.id`)
expectType<typeof f>(toBe<{ id: number; n: string | null }[]>())
// select without from
const g = await pg.query(`select (select count(*) from orders) as n`)
expectType<typeof g>(toBe<{ n: string | null }[]>())
// sqlite text key
const h = await sl.query(`select (select count(*) from orders o where o.user_id = u.id) from users u`)
expectType<typeof h>(toBe<{ "(select count(*) from orders o where o.user_id = u.id)": number | null }[]>())
// plain derived table still cannot see outer
const q3 = `select u.id from users u join (select o.id from orders o where o.user_id = u.id) t on t.id = u.id` as const
// @ts-expect-error
await pg.query(q3)
expectType<GetQueryError<typeof pg, typeof q3>>(toBe<DbtyperError<2307, "Unknown qualified column u.id">>())
// select list subquery inside a WHERE subquery
const i = await pg.query(`select u.id from users u where exists (select (select 1 from orders o2 where o2.id = o.id and o2.user_id = u.id) from orders o where o.user_id = u.id)`)
expectType<typeof i>(toBe<{ id: number }[]>())

const l1 = await pg.query(`select u.id, t.n from users u cross join lateral (select count(*) as n from orders o where o.user_id = u.id) t`)
expectType<typeof l1>(toBe<{ id: number; n: string }[]>())
const l2 = await pg.query(`select u.id, t.total from users u left join lateral (select o.total from orders o where o.user_id = u.id order by o.total desc limit 1) t on true`)
expectType<typeof l2>(toBe<{ id: number; total: number | null }[]>())
// lateral sees only items before it
const q4 = `select 1 as x from users u cross join lateral (select o2.id from orders o where o.id = o2.id) t join orders o2 on true` as const
// @ts-expect-error
await pg.query(q4)
expectType<GetQueryError<typeof pg, typeof q4>>(toBe<DbtyperError<2307, "Unknown qualified column o2.id">>())
const q5 = `select u.id from users u cross join lateral (select o.total from orders o where o.user_id = u.id) t` as const
// @ts-expect-error
await sl.query(q5)
expectType<GetQueryError<typeof sl, typeof q5>>(toBe<DbtyperError<1900, "LATERAL is PostgreSQL-only; this database is SQLite. Use a correlated subquery">>())
