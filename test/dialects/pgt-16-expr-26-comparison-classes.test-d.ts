// EXPR-26, EXPR-4, EXPR-14, EXPR-20, DML-16, PGT-16, TYPE-15: comparison classes; an untyped string literal fits the
// uuid, date/time and enum classes; an enum is a class of its own.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema app;`)
	.apply(`create type mood as enum ('sad', 'ok');`)
	.apply(`create type app.status as enum ('active', 'gone');`)
	.apply(
		`create table users (
			id uuid not null, name text not null, age integer not null, born date, at timestamptz not null,
			span interval, ip inet, doc jsonb, m mood not null, s app.status not null,
			made uuid default 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', day date default '2026-01-01',
			ok mood default 'ok'
		);`,
	)
	.database()

// PGT-16, EXPR-4: a literal against uuid, date/time, interval, inet, json
await db.query(`select * from users where id = '11111111-1111-1111-1111-111111111111'`)
await db.query(`select * from users where at > '2026-01-01' and born <= '2000-01-01' and '2000-01-01' < born`)
await db.query(`select * from users where span = '1 day' and ip = '10.0.0.1' and doc = '{}'`)
// EXPR-26: BETWEEN and simple CASE take the literal too
await db.query(`select * from users where born between '2000-01-01' and '2001-01-01'`)
await db.query(`select case born when '2000-01-01' then 1 else 2 end as x from users`)
// EXPR-14: IN
await db.query(`select * from users where born in ('2000-01-01', '2001-01-01')`)
// EXPR-20: a literal next to a date branch
const _case = await db.query(`select case when age > 1 then born else '2000-01-01' end as d from users`)
expectType<typeof _case>(toBe<{ d: Date | null }[]>())
await db.query(`select case when age > 1 then '2000-01-01' else born end as d from users`)
// DML-16: INSERT
await db.query(
	`insert into users (id, name, age, born, at, m, s) values ('11111111-1111-1111-1111-111111111111', 'a', 1, '2000-01-01', '2026-01-01', 'ok', 'active')`,
)

// EXPR-26: a literal against a numeric column stays an error
const numeric = `select * from users where age = 'not a number'` as const
// @ts-expect-error
await db.query(numeric)
expectType<GetQueryError<typeof db, typeof numeric>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

const inNumeric = `select * from users where age in ('1')` as const
// @ts-expect-error
await db.query(inNumeric)
expectType<GetQueryError<typeof db, typeof inNumeric>>(toBe<DbtyperError<2504, "Incompatible types in IN list">>())

// a text column is not a literal: text against uuid and date stays an error
const textCol = `select * from users where id = name` as const
// @ts-expect-error
await db.query(textCol)
expectType<GetQueryError<typeof db, typeof textCol>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

const insertNumeric = `insert into users (id, name, age, at, m, s) values ('11111111-1111-1111-1111-111111111111', 'a', 'x', '2026-01-01', 'ok', 'active')`
// @ts-expect-error
await db.query(insertNumeric)

// EXPR-26: an enum is a class of its own; the check says 2500 for another class, another enum and a text column
const enumInt = `select * from users where m = 123` as const
// @ts-expect-error
await db.query(enumInt)
expectType<GetQueryError<typeof db, typeof enumInt>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

const enumEnum = `select * from users where m = s` as const
// @ts-expect-error
await db.query(enumEnum)
expectType<GetQueryError<typeof db, typeof enumEnum>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

const enumText = `select * from users where m = name` as const
// @ts-expect-error
await db.query(enumText)
expectType<GetQueryError<typeof db, typeof enumText>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

const insertEnumInt =
	`insert into users (id, name, age, at, m, s) values ('11111111-1111-1111-1111-111111111111', 'a', 1, '2026-01-01', 5, 'active')` as const
// @ts-expect-error
await db.query(insertEnumInt)
expectType<GetQueryError<typeof db, typeof insertEnumInt>>(
	toBe<DbtyperError<2507, "Incompatible value type for column m">>(),
)

// TYPE-15, PGT-14: an IN with the literal on the left
await db.query(`select * from users where 'ok' in (m)`)
const inLeft = `select * from users where 'bad' in (m)` as const
// @ts-expect-error
await db.query(inLeft)
expectType<GetQueryError<typeof db, typeof inLeft>>(toBe<DbtyperError<2511, "'bad' is not a value of enum mood">>())

// TYPE-15, PGT-14: the label of a cast literal
await db.query(`select * from users where m = 'ok'::mood and m = cast('sad' as mood) and s = 'gone'::app.status`)
const castBad = `select 'nope'::mood as x` as const
// @ts-expect-error
await db.query(castBad)
expectType<GetQueryError<typeof db, typeof castBad>>(toBe<DbtyperError<2511, "'nope' is not a value of enum mood">>())

const castBadQualified = `select 'nope'::app.status as x` as const
// @ts-expect-error
await db.query(castBadQualified)
expectType<GetQueryError<typeof db, typeof castBadQualified>>(
	toBe<DbtyperError<2511, "'nope' is not a value of enum status">>(),
)

// TYPE-15, PGT-14: COALESCE over an enum
await db.query(`select coalesce(m, 'ok') as c from users`)
const coalesceBad = `select coalesce(m, 'nope') as c from users` as const
// @ts-expect-error
await db.query(coalesceBad)
expectType<GetQueryError<typeof db, typeof coalesceBad>>(
	toBe<DbtyperError<2511, "'nope' is not a value of enum mood">>(),
)
const coalesceFirst = `select coalesce('nope', m) as c from users` as const
// @ts-expect-error
await db.query(coalesceFirst)

// PGT-13: a schema-qualified enum name in a column type
const _q = await db.query(`select s from users`)
expectType<typeof _q>(toBe<{ s: "active" | "gone" }[]>())
const qualifiedBad = `select * from users where s = 'ok'` as const
// @ts-expect-error
await db.query(qualifiedBad)
expectType<GetQueryError<typeof db, typeof qualifiedBad>>(
	toBe<DbtyperError<2511, "'ok' is not a value of enum status">>(),
)
