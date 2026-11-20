// SQLT-33…SQLT-38: IS, LIKE/GLOB/REGEXP, arithmetic and `||`, JSON arrows, LIMIT forms and joins in a SQLite chain.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteBigintDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const ddl = `create table users (id integer primary key, name text not null, email text, score real, avatar blob);
	create table posts (id integer primary key, user_id integer not null, title text not null);`
const db = sqlMigrations({ driver: sqliteDriver }).apply(ddl).database()
const big = sqlMigrations({ driver: sqliteBigintDriver }).apply(ddl).database()

// SQLT-33: IS and IS NOT compare any two values null-safely; the result is a non-null integer
const _is = await db.query(
	`select email is name as a, email is not score as b, id is distinct from score as c, email is not distinct from :e as d from users`,
	{ e: "x" },
)
expectType<typeof _is>(toBe<Array<{ a: number; b: number; c: number; d: number }>>())
const _isNull = await db.query(`select email is null as a, email is not null as b from users`)
expectType<typeof _isNull>(toBe<Array<{ a: number; b: number }>>())
// SQLT-33: `IS DISTINCT` without FROM
const isDistinctQuery = `select email is distinct name from users` as const
// @ts-expect-error
db.query(isDistinctQuery)
expectType<GetQueryError<typeof db, typeof isDistinctQuery>>(
	toBe<DbtyperError<5008, "Expected FROM after IS DISTINCT">>(),
)

// SQLT-34: LIKE (with ESCAPE), GLOB and the NOT forms are integers; REGEXP needs a `regexp` function
const _like = await db.query(
	`select name like 'a%' escape '\\' as a, name glob 'a*' as b, name not like 'x' as c, name not glob 'y*' as d from users`,
)
expectType<typeof _like>(toBe<Array<{ a: number; b: number; c: number; d: number }>>())
const _where = await db.query(
	`select id from users where name like :p and id not in (1, 2) and id not between 5 and 9`,
	{
		p: "a%",
	},
)
expectType<typeof _where>(toBe<Array<{ id: number }>>())
const regexpQuery = `select id from users where name regexp 'a'` as const
// @ts-expect-error
db.query(regexpQuery)
expectType<GetQueryError<typeof db, typeof regexpQuery>>(
	toBe<DbtyperError<1917, "REGEXP needs a user function regexp(pattern, text); register one or use LIKE or GLOB">>(),
)
const notQuery = `select id from users where name not 'a'` as const
// @ts-expect-error
db.query(notQuery)
expectType<GetQueryError<typeof db, typeof notQuery>>(
	toBe<DbtyperError<5009, "Expected LIKE, IN or BETWEEN after NOT">>(),
)

// SQLT-35: integer arithmetic stays integer, REAL makes it REAL; `||` is TEXT for any operands
const _arith = await db.query(
	`select 7 / 2 as a, 7 / 2.0 as b, id + score as c, name || score as d, id || 'x' as e from users`,
)
expectType<typeof _arith>(toBe<Array<{ a: number; b: number; c: number | null; d: string | null; e: string }>>())
const _arithBig = await big.query(`select 7 / 2 as a, 7 / 2.0 as b, id * 2 as c from users`)
expectType<typeof _arithBig>(toBe<Array<{ a: bigint; b: number; c: bigint }>>())

// SQLT-36: `->` is TEXT (JSON), `->>` any storage class, both nullable
const _json = await db.query(`select name -> '$.a' as a, name ->> '$.a' as b from users`)
expectType<typeof _json>(toBe<Array<{ a: string | null; b: number | string | Uint8Array | null }>>())

// SQLT-37: LIMIT n [OFFSET m] and LIMIT m, n; FETCH FIRST is PostgreSQL-only
const _limit = await db.query(`select id from users order by id limit :n offset 2`, { n: 5 })
expectType<typeof _limit>(toBe<Array<{ id: number }>>())
const _comma = await db.query(`select id from users limit 2, 5`)
expectType<typeof _comma>(toBe<Array<{ id: number }>>())
const fetchQuery = `select id from users fetch first 2 rows only` as const
// @ts-expect-error
db.query(fetchQuery)
expectType<GetQueryError<typeof db, typeof fetchQuery>>(
	toBe<DbtyperError<1900, "FETCH FIRST is PostgreSQL-only; this database is SQLite. Use LIMIT">>(),
)

// SQLT-38: every join, RIGHT and FULL included, with the nullability of the outer side
const _inner = await db.query(`select u.name, p.title from users u join posts p on p.user_id = u.id`)
expectType<typeof _inner>(toBe<Array<{ name: string; title: string }>>())
const _right = await db.query(`select u.name, p.title from users u right join posts p on p.user_id = u.id`)
expectType<typeof _right>(toBe<Array<{ name: string | null; title: string }>>())
const _full = await db.query(`select u.name, p.title from users u full join posts p on p.user_id = u.id`)
expectType<typeof _full>(toBe<Array<{ name: string | null; title: string | null }>>())
const _left = await db.query(`select u.name, p.title from users u left join posts p on p.user_id = u.id`)
expectType<typeof _left>(toBe<Array<{ name: string; title: string | null }>>())
