// Integration Test: SCHEMA-11, SCHEMA-16, SCHEMA-17, SCHEMA-18, SCHEMA-24, SCHEMA-26, SCHEMA-28 Checks (verification/schema.md @ 2a941c8)
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

type Code<E> = E extends { __sql_parser_error_code__: infer C } ? C : never
const base = sqlMigrations({ driver: mockDriver })

// SCHEMA-11: NOT NULL / nullable columns
const s11 = base.apply(`create table t (id int not null, a text, b text null);`).database()
const _s11 = await s11.query(`select * from t;`)
expectType<typeof _s11>(toBe<{ id: number; a: string | null; b: string | null }[]>())

// ❌ ERROR: SCHEMA-11 `not xyz`
const s11bad = `create table t (a int not xyz);` as const
// @ts-expect-error
base.apply(s11bad)
expectType<GetApplyError<typeof base, typeof s11bad>>(toBe<DbtyperError<1510, "Expected NULL after NOT">>())

// ❌ ERROR: SCHEMA-16 duplicate column in CREATE TABLE
const s16 = `create table x (id int, id text);` as const
// @ts-expect-error
base.apply(s16)
expectType<GetApplyError<typeof base, typeof s16>>(toBe<DbtyperError<3208, "Column id already exists">>())

// SCHEMA-17: view with a column list, and without
const withT = base.apply(`create table t (id int not null, title text not null);`)
const s17 = withT.apply(`create view v (a, b) as select id, title from t;`).database()
const _s17 = await s17.query(`select * from v;`)
expectType<typeof _s17>(toBe<{ a: number; b: string }[]>())
const s17b = withT.apply(`create view v as select id, title from t;`).database()
const _s17b = await s17b.query(`select * from v;`)
expectType<typeof _s17b>(toBe<{ id: number; title: string }[]>())

// ❌ ERROR: SCHEMA-17 column list count differs
const s17bad = `create view v (a) as select id, title from t;` as const
// @ts-expect-error
withT.apply(s17bad)
expectType<GetApplyError<typeof withT, typeof s17bad>>(
	toBe<DbtyperError<3910, "CREATE VIEW v: the column list has a different number of columns than the SELECT">>(),
)
// ❌ ERROR: SCHEMA-17 unknown column in the view's SELECT
const s17unk = `create view bad_v as select nope_col from t;` as const
// @ts-expect-error
withT.apply(s17unk)
expectType<Code<GetApplyError<typeof withT, typeof s17unk>>>(toBe<2300>())

// ❌ ERROR: SCHEMA-18 each syntax and name error
const items = base.apply(`create table items (id int not null); create table users (id int not null);`)
const v1 = `create view items as select 1 as id;` as const
const v2 = `create view ghost_schema.v as select * from users;` as const
const v3 = `create view as select 1;` as const
const v4 = `create view public. as select 1;` as const
const v5 = `create view v select 1;` as const
const v6 = `create view public.v select 1;` as const
const v7 = `create view v as 1;` as const
// @ts-expect-error
items.apply(v1)
// @ts-expect-error
items.apply(v2)
// @ts-expect-error
items.apply(v3)
// @ts-expect-error
items.apply(v4)
// @ts-expect-error
items.apply(v5)
// @ts-expect-error
items.apply(v6)
// @ts-expect-error
items.apply(v7)
expectType<Code<GetApplyError<typeof items, typeof v1>>>(toBe<3211>())
expectType<Code<GetApplyError<typeof items, typeof v2>>>(toBe<2214>())
expectType<Code<GetApplyError<typeof items, typeof v3>>>(toBe<3900>())
expectType<Code<GetApplyError<typeof items, typeof v4>>>(toBe<3901>())
expectType<Code<GetApplyError<typeof items, typeof v5>>>(toBe<3903>())
expectType<Code<GetApplyError<typeof items, typeof v6>>>(toBe<3904>())
expectType<Code<GetApplyError<typeof items, typeof v7>>>(toBe<1104>())

// SCHEMA-24: IF EXISTS on an existing table adds the column
const s24 = base.apply(`create table t (id int not null); alter table if exists t add column q int;`).database()
const _s24 = await s24.query(`select * from t;`)
expectType<typeof _s24>(toBe<{ id: number; q: number | null }[]>())
// ❌ ERROR: SCHEMA-24 `alter table if t`
const s24bad = `alter table if t add column q int;` as const
const s24t = base.apply(`create table t (id int not null);`)
// @ts-expect-error
s24t.apply(s24bad)
expectType<GetApplyError<typeof s24t, typeof s24bad>>(
	toBe<DbtyperError<1610, "Expected `exists` after `IF` in ALTER TABLE">>(),
)

// SCHEMA-26: typed query, no type argument
const s26 = base.apply(`create table t (id int not null, name text)`).database()
const _s26 = await s26.query(`select id, name from t`)
expectType<typeof _s26>(toBe<{ id: number; name: string | null }[]>())

// ❌ ERROR: SCHEMA-28 create schema public on PostgreSQL
const s28 = `create schema public;` as const
// @ts-expect-error
base.apply(s28)
expectType<GetApplyError<typeof base, typeof s28>>(
	toBe<DbtyperError<3200, "Schema already exists; use IF NOT EXISTS">>(),
)
// SCHEMA-28: IF NOT EXISTS is fine
const s28ok = base.apply(`create schema if not exists public; create table t (id int);`).database()
const _s28 = await s28ok.query(`select id from t`)
expectType<typeof _s28>(toBe<{ id: number | null }[]>())
void (null as unknown as GetQueryError<typeof s28ok, "select id from t">)
