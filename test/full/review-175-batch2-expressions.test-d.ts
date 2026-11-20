// Review #175, batch 2 (expressions and parameters): #153, #155, #161, #162, #163, #164, EXPR-Q6, CORE-6, PGT-17.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const schema =
	`create table users (id integer primary key, name text not null, email text, age integer, ok boolean, Mixed text);
	create table posts (id integer primary key, user_id integer not null, title text, body text not null);` as const

const pg = sqlMigrations({ driver: mockDriver })
	.apply(schema)
	.apply(
		`create table t (id serial primary key, c citext not null, d character(3), n name, f float, iv interval, tm time,
			score numeric, big bigint not null, small smallint not null, born date);`,
	)
	.database()
const lite = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()

// #153 (PGT-3, PGT-35): a literal with a fraction or an exponent is numeric, one beyond int4 is bigint; arithmetic widens
const _lit = await pg.query(`select 1.5 as c, 10000000000 as f, 1e10 as e, 2147483647 as i, 2147483648 as b, 0 as z`)
expectType<typeof _lit>(toBe<{ c: string; f: string; e: string; i: number; b: string; z: number }[]>())
const _arith = await pg.query(
	`select id / 2.0 as k, id * 1.5 as l, 1 + score as h, id + big as g, small + id as s, big + id as r, f * id as d,
		power(score, 2) as p, power(id, 2) as q, sign(id) as sg, pi() as pi from t`,
)
expectType<typeof _arith>(
	toBe<
		{
			k: string
			l: string
			h: string | null
			g: string
			s: number
			r: string
			d: number | null
			p: string | null
			q: number
			sg: number
			pi: number
		}[]
	>(),
)
// SQLT-35 stays: REAL for a fraction, integers otherwise
const _liteLit = await lite.query(`select 1.5 as c, 10000000000 as f, id + 1.5 as r, id + 1 as i from users`)
expectType<typeof _liteLit>(toBe<{ c: number; f: number; r: number; i: number }[]>())

// #155 (CORE-2): IN (subquery) and ANY are NULL when the left side or a candidate is NULL
const _in = await pg.query(
	`select age in (select id from posts) as a, id in (select age from users) as c, id = any(array[age]) as d,
		id in (select id from posts) as e, id = any(array[id]) as f, id = any(select age from users) as g from users`,
)
expectType<typeof _in>(
	toBe<{ a: boolean | null; c: boolean | null; d: boolean | null; e: boolean; f: boolean; g: boolean | null }[]>(),
)
const _liteIn = await lite.query(
	`select age in (select id from posts) as a, id in (select id from posts) as e from users`,
)
expectType<typeof _liteIn>(toBe<{ a: number | null; e: number }[]>())

// #161 (SQLT-9): a SQLite BOOLEAN is an integer; TRUE / FALSE are integers; an integer may be a condition
await lite.query(`select name from users where ok = 1`)
await lite.query(`select name from users where ok = 0 or ok <> 1`)
await lite.query(`insert into users (name, ok) values ('a', 1)`)
await lite.query(`insert into users (name, ok, age) values ('a', true, false)`)
await lite.query(`update users set ok = 1, age = true where id = 1`)
await lite.query(`select name from users where (age > 1) = 1 and ok = true and age = true`)
await lite.query(`select name from users where ok = ?`, [1])
await lite.query(`select name from users where ok`)
await lite.query(`select name from users where age and not ok or 1`)
const _liteCase = await lite.query(`select case when age then 'a' else 'b' end as x, ok, age > 1 as gt from users`)
expectType<typeof _liteCase>(toBe<{ x: string; ok: number | null; gt: number | null }[]>())
sqlMigrations({ driver: sqliteDriver }).apply(`create table x (z integer default true, b boolean default 0);`)
// a text column is still no condition, and PostgreSQL keeps its boolean class
const liteTextCond = `select name from users where name` as const
expectType<GetQueryError<typeof lite, typeof liteTextCond>>(
	toBe<DbtyperError<2600, "Expression must be boolean, but has a type text.">>(),
)
const pgIntCond = `select name from users where age` as const
expectType<GetQueryError<typeof pg, typeof pgIntCond>>(
	toBe<DbtyperError<2600, "Expression must be boolean, but has a type integer.">>(),
)
const pgBoolInt = `select name from users where ok = 1` as const
expectType<GetQueryError<typeof pg, typeof pgBoolInt>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

// #162: float, citext, character, name, interval and time in expressions
const _f = await pg.query(
	`select f + 1 as a, -f as b, sum(f) as s, avg(f) as v, c || 'x' as cc, d || n as dn, iv * 2 as i2, 2 * iv as i3,
		tm + iv as t2, iv / 2 as i4, -iv as i5 from t group by f, c, d, n, iv, tm`,
)
expectType<typeof _f>(
	toBe<
		{
			a: number | null
			b: number | null
			s: number | null
			v: number | null
			cc: string
			dn: string | null
			i2: string | null
			i3: string | null
			t2: string | null
			i4: string | null
			i5: string | null
		}[]
	>(),
)
await pg.query(`select id from t where c like 'a%' and d like 'a%' and n like 'a%'`)
const citextInt = `select id from t where c = 5` as const
expectType<GetQueryError<typeof pg, typeof citextInt>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())
const floatText = `insert into t (c, f, big, small) values ('a', 'x', 1, 1)` as const
expectType<GetQueryError<typeof pg, typeof floatText>>(
	toBe<DbtyperError<2507, "Incompatible value type for column f">>(),
)

// #163 (PGT-12, FN-22): a parameter as the array of ANY
const _any = await pg.query(`select id from users where id = any($1)`, [[1, 2]])
expectType<typeof _any>(toBe<{ id: number }[]>())
await pg.query(`select id from users where name = any(:names) and id <> all(:ids)`, { names: ["a"], ids: [1] })
const anyWrong = `select id from users where id = any($1)` as const
expectType<GetQueryError<typeof pg, typeof anyWrong, [string[]]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter $1">>(),
)

// #164 (CORE-6): a parameter in ||, under unary minus and where a condition is needed
await pg.query(`select id from users where name like $1 || '%'`, ["a"])
await pg.query(`select id from users where name like '%' || $1 || '%'`, ["a"])
await pg.query(`select id from users where name = $1 || $2`, ["a", "b"])
await pg.query(`select id from users where id = -$1`, [1])
await pg.query(`select id from users where $1`, [true])
await pg.query(`select id from users where $1 and ok`, [true])
await pg.query(`select id from users where ok or not $1`, [true])
await pg.query(`select id from users where $1 and $2`, [true, false])
await pg.query(`select case when $1 then 1 else 2 end as x from users`, [true])
await lite.query(`select id from users where name like ? || '%'`, ["a"])
await lite.query(`select id from users where id = - ?`, [1])
await lite.query(`select id from users where ? and ok`, [1])
const concatNumber = `select id from users where name like $1 || '%'` as const
expectType<GetQueryError<typeof pg, typeof concatNumber, [number]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter $1">>(),
)
const condNumber = `select id from users where $1 and ok` as const
expectType<GetQueryError<typeof pg, typeof condNumber, [number]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter $1">>(),
)
// a parameter alone under a minus has no type from its position (CORE-7), not "requires a number"
const negAlone = `select -$1 as x` as const
expectType<GetQueryError<typeof pg, typeof negAlone, [number]>>(
	toBe<DbtyperError<2405, "cannot infer the type of parameter $1; use CAST($1 AS …)">>(),
)

// EXPR-Q6: text || <any non-array type> is text (2804 and 2805 are retired)
const _concat = await pg.query(
	`select name || id as a, id || name as b, name || ok as c, name || now() as d, 'n' || 1.5 as e from users`,
)
expectType<typeof _concat>(toBe<{ a: string; b: string; c: string | null; d: string; e: string }[]>())
const noText = `select id || id as a from users` as const
expectType<GetQueryError<typeof pg, typeof noText>>(toBe<DbtyperError<2800, "|| requires at least one text operand">>())

// CORE-6: a parameter the SQL tests for NULL accepts null
await pg.query(`select id from users where ($1 is null or age > $1)`, [null])
await pg.query(`select id from users where ($1 is null or age > $1)`, [5])
await pg.query(`select id from users where (:min is not null and age > :min) or name = :name`, { min: null, name: "a" })
const notTested = `select id from users where age > $1` as const
expectType<GetQueryError<typeof pg, typeof notTested, [null]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter $1">>(),
)
const nullTestedWrong = `select id from users where ($1 is null or age > $1)` as const
expectType<GetQueryError<typeof pg, typeof nullTestedWrong, [string]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter $1">>(),
)

// PGT-17: a date parameter accepts Date | string
await pg.query(`select id from t where born = $1 or born > $2`, ["2020-01-01", new Date()])

// the function catalog line: nullif, sign, pi, encode and the hints' targets exist in PostgreSQL
const _fn = await pg.query(
	`select nullif(name, '') as n, encode(decode('00', 'hex'), 'hex') as e, cast(pg_typeof(id) as text) as t,
		gen_random_bytes(4) as r from users`,
)
expectType<typeof _fn>(toBe<{ n: string | null; e: string; t: string; r: Uint8Array }[]>())
