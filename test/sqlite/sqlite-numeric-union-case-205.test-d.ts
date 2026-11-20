// #205 (spec decisions on dbtyper-spec PR #19), SQLite only:
// 1. UNION / INTERSECT / EXCEPT of a NUMERIC-affinity column with a TEXT column is `number | string`.
// 2. CASE with NUMERIC and TEXT branches is `number | string` (CORE-21).
// 3. A single-quoted name in an INSERT column list is the identifier (SQLT-68).
// TEXT against INTEGER stays an error (SQLT-56); PostgreSQL is unchanged. SQLite has no arrays: no array unification.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table t (n number not null, s text not null, i integer not null, nn number, ss text);
		create table u (n number not null, s text not null);`,
	)
	.database()

// 1. set operations, both orders, all three operators
const _un = await db.query(`select n as v from t union select s from t`)
expectType<typeof _un>(toBe<Array<{ v: number | string }>>())
const _unRev = await db.query(`select s as v from t union all select n from t`)
expectType<typeof _unRev>(toBe<Array<{ v: number | string }>>())
const _inter = await db.query(`select s as v from t intersect select n from u`)
expectType<typeof _inter>(toBe<Array<{ v: number | string }>>())
const _exc = await db.query(`select n as v from t except select s from u`)
expectType<typeof _exc>(toBe<Array<{ v: number | string }>>())
const _nullable = await db.query(`select s as v from t union select nn from t`)
expectType<typeof _nullable>(toBe<Array<{ v: number | string | null }>>())
const _chain = await db.query(`select n as v from t union select s from t union select ss from t`)
expectType<typeof _chain>(toBe<Array<{ v: number | string | null }>>())
const _cte = await db.query(`with c(v) as (select n from t union select s from t) select v from c`)
expectType<typeof _cte>(toBe<Array<{ v: number | string }>>())
// NUMERIC with INTEGER is unchanged
const _numInt = await db.query(`select n as v from t union select i from t`)
expectType<typeof _numInt>(toBe<Array<{ v: number | string }>>())

// 2. CASE
const _case = await db.query(`select case when i > 0 then n else s end as v from t`)
expectType<typeof _case>(toBe<Array<{ v: number | string }>>())
const _caseRev = await db.query(`select case when i > 0 then s else n end as v from t`)
expectType<typeof _caseRev>(toBe<Array<{ v: number | string }>>())
const _caseNull = await db.query(`select case i when 1 then s when 2 then nn end as v from t`)
expectType<typeof _caseNull>(toBe<Array<{ v: number | string | null }>>())

// Still errors: TEXT against INTEGER (SQLT-56)
const _unInt = `select s as v from t union select i from t` as const
expectType<GetQueryError<typeof db, typeof _unInt>>(
	toBe<DbtyperError<3409, "Incompatible types in UNION for column v">>(),
)
const _caseInt = `select case when i > 0 then i else s end as v from t` as const
expectType<GetQueryError<typeof db, typeof _caseInt>>(toBe<DbtyperError<2502, "Incompatible types in CASE">>())

// 3. a single-quoted name in the INSERT column list
const ins = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table q ('order' integer not null, Name text);
		insert into q ('order', 'name') values (1, 'a');
		insert into q ("order") values (2);`,
	)
	.database()
const _ins = await ins.query(`select "order", name from q`)
expectType<typeof _ins>(toBe<Array<{ order: number; Name: string | null }>>())
const _insBad = `insert into q ('nope') values (1);` as const
// @ts-expect-error
sqlMigrations({ driver: sqliteDriver }).apply(`create table q (a integer);`).apply(_insBad)

// PostgreSQL unchanged
const _pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table p (n numeric not null, s text not null);`)
	.database()
const _pgUn = `select n as v from p union select s from p` as const
expectType<GetQueryError<typeof _pg, typeof _pgUn>>(
	toBe<DbtyperError<3409, "Incompatible types in UNION for column v">>(),
)
