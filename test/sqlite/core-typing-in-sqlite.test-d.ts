// CORE-3, CORE-4, CORE-7, CORE-9, CORE-12, CORE-13, CORE-17 with a SQLite driver (the PostgreSQL versions are in test/integration).
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteMockDriver })
const db = migrations
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.apply(`create table a (id integer not null, x text not null);`)
	.apply(`create table b (id integer not null, y text not null);`)
	.apply(`create table c (id integer, z text not null);`)
	.database()

// CORE-3: count is non-null; sum, avg, min, max are nullable also over NOT NULL columns
const _count = await db.query(`select count(*) as c, count(email) as d from users;`)
expectType<typeof _count>(toBe<{ c: number; d: number }[]>())
const _agg = await db.query(`select sum(id) as s, min(id) as lo, max(id) as hi from users;`)
expectType<typeof _agg>(toBe<{ s: number | null; lo: number | null; hi: number | null }[]>())

// CORE-4: a scalar subquery is nullable, EXISTS is not
const _sub = await db.query(`select (select id from users) as s from users;`)
expectType<typeof _sub>(toBe<{ s: number | null }[]>())
// the mock driver's type map has no boolean, so EXISTS (a boolean, an integer in SQLite) uses the real type map
const _exists = await sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer not null);`)
	.database()
	.query(`select exists (select 1 from users) as x from users;`)
expectType<typeof _exists>(toBe<{ x: number }[]>())

// CORE-7: a parameter without a type from its position needs a CAST
const castQuery = `select :x as x;` as const
// @ts-expect-error
await db.query(castQuery, { x: "s" })
expectType<GetQueryError<typeof db, typeof castQuery, { x: string }>>(
	toBe<DbtyperError<2405, "cannot infer the type of parameter :x; use CAST(:x AS …)">>(),
)
const _cast = await db.query(`select cast(:x as text) as x;`, { x: "s" })
expectType<typeof _cast>(toBe<Array<{ x: string }>>())

// CORE-9: USING and NATURAL JOIN; the shared column appears once; FULL JOIN nullable only if nullable on both sides
const _using = await db.query(`select id from a join b using (id);`)
expectType<typeof _using>(toBe<{ id: number }[]>())
const _natural = await db.query(`select id, c.z from a natural join c;`)
expectType<typeof _natural>(toBe<{ id: number; z: string }[]>())
const _full = await db.query(`select id from a full join c using (id);`)
expectType<typeof _full>(toBe<{ id: number }[]>())
const usingMissing = `select a.id from a join b using (x);` as const
// @ts-expect-error
await db.query(usingMissing)
expectType<GetQueryError<typeof db, typeof usingMissing>>(
	toBe<DbtyperError<3411, "Column x specified in USING clause does not exist in both join sides">>(),
)

// CORE-12: WITH RECURSIVE; nullable if the recursive part makes it so
const _rec = await db.query(
	`with recursive t as (select id, email from users union all select id, null as email from t) select id, email from t;`,
)
expectType<typeof _rec>(toBe<{ id: number; email: string | null }[]>())

// CORE-13: a statement without RETURNING resolves to an empty row list
const _ins = await db.query(`insert into users (id, name) values (1, 'A');`)
expectType<typeof _ins>(toBe<[]>())
const _upd = await db.query(`update users set name = 'B' where id = 1;`)
expectType<typeof _upd>(toBe<[]>())
const _del = await db.query(`delete from users where id = 1;`)
expectType<typeof _del>(toBe<[]>())

// CORE-17: a REFERENCES target that does not exist
const noTable = `create table t (g integer references ghost(id));` as const
// @ts-expect-error
migrations.apply(noTable)
expectType<GetApplyError<typeof migrations, typeof noTable>>(
	toBe<DbtyperError<2200, "Unknown table ghost in REFERENCES">>(),
)
const noColumn =
	`create table b2 (id integer primary key); create table t (g integer, foreign key (g) references b2 (nope));` as const
// @ts-expect-error
migrations.apply(noColumn)
expectType<GetApplyError<typeof migrations, typeof noColumn>>(
	toBe<DbtyperError<2300, "Unknown column nope in REFERENCES">>(),
)
