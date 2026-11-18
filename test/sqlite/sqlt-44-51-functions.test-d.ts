// SQLT-44 … SQLT-51: result types of SQLite functions; SQLT-52: other functions are unknown (FN-1).
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (id integer primary key, name text not null, nick text, age integer, score real not null);`)
	.database()

// SQLT-44
const _text = await db.query(
	`select lower(name) as a, upper(nick) as b, trim(name) as c, replace(name, 'a', 'b') as d, substr(name, 1, 2) as e, quote(name) as f, hex(name) as g, printf('%d', age) as h from t`,
)
expectType<typeof _text>(
	toBe<
		Array<{ a: string; b: string | null; c: string; d: string; e: string; f: string; g: string; h: string | null }>
	>(),
)
const _len = await db.query(
	`select length(name) as a, length(nick) as b, instr(name, 'x') as c, unicode(name) as d from t`,
)
expectType<typeof _len>(toBe<Array<{ a: number; b: number | null; c: number; d: number }>>())

// SQLT-45
const _nulls = await db.query(
	`select coalesce(nick, 'x') as a, coalesce(nick, age) as b, ifnull(age, 0) as c, nullif(name, 'x') as d, iif(age > 1, name, 'z') as e, iif(age > 1, nick, 'z') as f from t`,
)
expectType<typeof _nulls>(
	toBe<
		Array<{
			a: string
			b: string | number | Uint8Array | null
			c: number
			d: string | null
			e: string
			f: string | null
		}>
	>(),
)

// SQLT-46
const _num = await db.query(
	`select abs(age) as a, abs(score) as b, round(score) as c, sign(age) as d, random() as e, max(age, 3) as f, min(score, 1) as g, max(name, nick) as h, sqrt(score) as i, pi() as j from t`,
)
expectType<typeof _num>(
	toBe<
		Array<{
			a: number | null
			b: number
			c: number
			d: number | null
			e: number
			f: number | null
			g: number
			h: string | null
			i: number
			j: number
		}>
	>(),
)

// SQLT-47
const _agg = await db.query(
	`select count(*) as a, count(nick) as b, sum(age) as c, sum(score) as d, total(age) as e, avg(age) as f, min(age) as g, max(name) as h, group_concat(name) as i from t`,
)
expectType<typeof _agg>(
	toBe<
		Array<{
			a: number
			b: number
			c: number | null
			d: number | null
			e: number
			f: number | null
			g: number | null
			h: string | null
			i: string | null
		}>
	>(),
)

// SQLT-48
const _date = await db.query(`select datetime('now') as d, current_timestamp as c`)
expectType<typeof _date>(toBe<Array<{ d: string | null; c: string }>>())
const _date2 = await db.query(
	`select date('now') as a, time('now') as b, strftime('%Y', 'now') as c, julianday('now') as d, unixepoch('now') as e, current_date as f, current_time as g from t`,
)
expectType<typeof _date2>(
	toBe<
		Array<{
			a: string | null
			b: string | null
			c: string | null
			d: number | null
			e: number | null
			f: string
			g: string
		}>
	>(),
)

// SQLT-49
const _json = await db.query(
	`select json_array(1, 2) as a, json_object('a', name) as b, json_array_length(nick) as c, json_valid(name) as d, json_extract(nick, '$.a') as e, json_type(name) as f from t`,
)
expectType<typeof _json>(
	toBe<
		Array<{ a: string; b: string; c: number | null; d: number; e: string | number | Uint8Array | null; f: string }>
	>(),
)

// SQLT-50
const _other = await db.query(
	`select typeof(age) as a, randomblob(4) as b, last_insert_rowid() as c, changes() as d, total_changes() as e, likely(age) as f from t`,
)
expectType<typeof _other>(
	toBe<
		Array<{
			a: "null" | "integer" | "real" | "text" | "blob"
			b: Uint8Array
			c: number
			d: number
			e: number
			f: number | null
		}>
	>(),
)

// SQLT-51
const _win = await db.query(
	`select row_number() over (order by id) as a, rank() over (partition by name order by id) as b, dense_rank() over (order by id) as c, ntile(4) over (order by id) as d, lag(age) over (order by id) as e, lead(name, 1, 'x') over (order by id) as f, first_value(name) over (order by id) as g, sum(age) over (partition by name) as h, count(*) over () as i, max(score) over (order by id rows between unbounded preceding and current row) as k from t`,
)
expectType<typeof _win>(
	toBe<
		Array<{
			a: number
			b: number
			c: number
			d: number
			e: number | null
			f: string
			g: string
			h: number | null
			i: number
			k: number | null
		}>
	>(),
)
const _filter = await db.query(
	`select sum(age) filter (where age > 1) as j, count(*) filter (where name = 'a') as k from t`,
)
expectType<typeof _filter>(toBe<Array<{ j: number | null; k: number }>>())
// a window function without OVER
const _noOver = `select row_number() as a from t` as const
expectType<GetQueryError<typeof db, typeof _noOver>>(
	toBe<DbtyperError<3620, "Window function `row_number` needs an OVER clause">>(),
)

// SQLT-52
const _now = `select now() as n` as const
expectType<GetQueryError<typeof db, typeof _now>>(
	toBe<
		DbtyperError<3619, "Unknown function: now. now() is PostgreSQL-only; use datetime('now') or CURRENT_TIMESTAMP">
	>(),
)
const _uuid = `select gen_random_uuid() as n` as const
expectType<GetQueryError<typeof db, typeof _uuid>>(
	toBe<
		DbtyperError<
			3619,
			"Unknown function: gen_random_uuid. gen_random_uuid() is PostgreSQL-only; use lower(hex(randomblob(16)))"
		>
	>(),
)
const _nope = `select nonesuch(1) as n` as const
expectType<GetQueryError<typeof db, typeof _nope>>(toBe<DbtyperError<3619, "Unknown function: nonesuch">>())

// PostgreSQL keeps its own catalog
const pg = sqlMigrations({ driver: (await import("../test-utils/test-databases.ts")).mockDriver })
	.apply(`create schema public;`)
	.database()
const _pgNow = await pg.query(`select now() as n`)
expectType<typeof _pgNow>(toBe<Array<{ n: Date }>>())
