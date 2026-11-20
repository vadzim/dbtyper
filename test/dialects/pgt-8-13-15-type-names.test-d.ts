// PGT-8, PGT-13, PGT-15 (#159, #171; review #175 batch 4): PostgreSQL type names of several words, interval fields,
// ALTER TYPE … RENAME VALUE / ADD VALUE IF NOT EXISTS | BEFORE | AFTER, composite types.
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const base = sqlMigrations({ driver: mockDriver })
type M<S extends string> = GetApplyError<typeof base, S>

// #159: a word joins the type name only where a known name of several words goes on
expectType<M<`create table kw (c int nut null);`>>(
	toBe<DbtyperError<1505, "Expected `,` or `)` after column definition">>(),
)
// @ts-expect-error a typo of PRIMARY KEY
base.apply(`create table kw (i int primary_key);`)
// @ts-expect-error a missing comma
base.apply(`create table kw (a int b int);`)
// @ts-expect-error not a PostgreSQL type modifier
base.apply(`create table kw (f integer unsigned);`)
const words = base
	.apply(
		`create table w (a double precision not null, b character varying(5), c timestamp with time zone,
		d timestamp(3) without time zone, e time with time zone, f bit varying(3));`,
	)
	.database()
const _w = await words.query(`select a, b, c, d, e from w`)
expectType<typeof _w>(toBe<{ a: number; b: string | null; c: Date | null; d: Date | null; e: string | null }[]>())

// a bad type modifier is reported as such (it fell through to 1505)
expectType<M<`create table m (a varchar(x));`>>(toBe<DbtyperError<5101, "Expected number for VARCHAR length">>())
expectType<M<`create table m (a numeric(10, x));`>>(toBe<DbtyperError<5105, "Expected scale number">>())

// #171, PGT-8: interval with fields or precision is a string
const iv = base
	.apply(`create table iv (a interval year to month, b interval day, c interval(3), d interval day to second(2));`)
	.database()
const _iv = await iv.query(`select a, b, c, d from iv`)
expectType<typeof _iv>(toBe<{ a: string | null; b: string | null; c: string | null; d: string | null }[]>())

// #171, PGT-13: ALTER TYPE … RENAME VALUE, ADD VALUE IF NOT EXISTS | BEFORE | AFTER change the union
const enums = base
	.apply(`create type mood as enum ('a', 'b'); create table t (m mood not null);`)
	.apply(`alter type mood rename value 'a' to 'c';`)
	.apply(`alter type mood add value if not exists 'b';`)
	.apply(`alter type mood add value 'x' before 'b';`)
	.apply(`alter type mood add value if not exists 'y' after 'x';`)
	.database()
const _e = await enums.query(`select m from t`)
expectType<typeof _e>(toBe<{ m: "c" | "x" | "y" | "b" }[]>())
const _withMood = base.apply(`create type mood as enum ('a', 'b');`)
type EM<S extends string> = GetApplyError<typeof _withMood, S>
expectType<EM<`alter type mood rename value 'nope' to 'c';`>>(
	toBe<DbtyperError<3307, "'nope' is not a value of the enum">>(),
)
expectType<EM<`alter type mood rename value 'a' to 'b';`>>(toBe<DbtyperError<3305, "Enum value already exists">>())
expectType<EM<`alter type mood rename value 'a' 'c';`>>(
	toBe<DbtyperError<4003, "Expected `TO` after the old label in ALTER TYPE … RENAME VALUE">>(),
)
expectType<EM<`alter type mood add value 'z' after 'nope';`>>(
	toBe<DbtyperError<3307, "'nope' is not a value of the enum">>(),
)
expectType<EM<`alter type mood add value 'a';`>>(toBe<DbtyperError<3305, "Enum value already exists">>())

// PGT-15: a composite type may be created; a column of it has no TypeScript type (CORE-14 at use)
const comp = base.apply(`create type pair as (a int, b text); create table p (id int not null, v pair);`).database()
const _c = await comp.query(`select id from p`)
expectType<typeof _c>(toBe<{ id: number }[]>())
// @ts-expect-error CORE-14: no TypeScript type for pair
await comp.query(`select v from p`)
expectType<M<`create type pair as (a int); create type pair as (b int);`>>(
	toBe<DbtyperError<3205, "Type already exists; use IF NOT EXISTS">>(),
)
expectType<M<`create type pair as (a int); create type if not exists pair as (b int); drop type pair;`>>(toBe<null>())

// PGT-15: the whole Check line on its own table: `vector(3)` applies, selecting it is 3506, `vec::text` is a string
const vecDb = base.apply(`create table t (id integer not null, vec vector(3) not null)`)
const vecD = vecDb.database()
const _vid = await vecD.query(`select id from t`)
expectType<typeof _vid>(toBe<{ id: number }[]>())
expectType<GetQueryError<typeof vecD, `select vec from t`>>(
	toBe<
		DbtyperError<
			3506,
			"No TypeScript type for SQL type vector in the driver's type map; select it with a cast, e.g. `::text`"
		>
	>(),
)
const _vtext = await vecD.query(`select vec::text as v from t`)
expectType<typeof _vtext>(toBe<{ v: string }[]>())
