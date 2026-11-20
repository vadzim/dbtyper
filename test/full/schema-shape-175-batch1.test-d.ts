// Review #175 batch 1: declaration order (#150), declared result keys (SQLT-28, #151), CREATE TABLE IF NOT EXISTS reads
// the statement (#172), a trailing comma and a second PRIMARY KEY in CREATE TABLE, duplicate view column names, and the
// lexer: non-ASCII and `$` in identifiers, an unclosed block comment, form feed as whitespace.
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const ddl = `create table y (id integer primary key, user_id integer not null, title text);`

// #150: INSERT without a column list and INSERT … SELECT * match the columns in CREATE TABLE order (both dialects)
const pg = sqlMigrations({ driver: mockDriver }).apply(ddl)
const lite = sqlMigrations({ driver: sqliteDriver }).apply(ddl)
const pgDb = pg.database()
const liteDb = lite.database()
await pgDb.query(`insert into y values (1, 2, 't')`)
await liteDb.query(`insert into y values (1, 2, 't')`)
await pgDb.query(`insert into y (id, user_id, title) select * from y`)
await liteDb.query(`insert into y (id, user_id, title) select * from y`)
// @ts-expect-error 2507: `title` gets 2
await pgDb.query(`insert into y values (1, 't', 2)`)
// `select *` keeps the order too, as an arm of a UNION
const _u = await pgDb.query(`select * from y union all select id, user_id, title from y`)
expectType<typeof _u>(toBe<Array<{ id: number; user_id: number; title: string | null }>>())
// @ts-expect-error 2512: the arms differ by position
await pgDb.query(`select * from y union all select title, id, user_id from y`)

// ADD COLUMN goes last, RENAME COLUMN keeps the place, DROP COLUMN leaves (PostgreSQL)
const pgAltered = pg
	.apply(`alter table y add column body text not null default ''; alter table y rename column user_id to owner_id;`)
	.apply(`alter table y drop column title;`)
	.database()
await pgAltered.query(`insert into y values (1, 2, 'b')`)
// @ts-expect-error 2507: `owner_id` is second
await pgAltered.query(`insert into y values (1, 'b', 2)`)

// a view and CREATE TABLE AS keep the output order
const pgViews = pg
	.apply(`create view v as select title, id from y; create table c as select title, user_id from y;`)
	.database()
await pgViews.query(`insert into c values ('t', 1)`)
await pgViews.query(`insert into c select * from v`)
// @ts-expect-error 2508: `select *` from the view is (title, id)
await pgViews.query(`insert into y (id, title) select * from v`)

// SQLT-28, #151: SQLite returns the declared name of a column, whatever case the query uses
const mixed = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer primary key, name text not null, Mixed text, "Quoted" integer);`)
	.apply(`alter table users add column LateAdd text; alter table users rename column name to FullName;`)
const mixedDb = mixed.database()
const _k1 = await mixedDb.query(`select MIXED, users.quoted, "ID", fullname, lateadd from users`)
expectType<typeof _k1>(
	toBe<
		Array<{ Mixed: string | null; Quoted: number | null; id: number; FullName: string; LateAdd: string | null }>
	>(),
)
const _k2 = await mixedDb.query(`select * from users`)
expectType<typeof _k2>(
	toBe<
		Array<{ id: number; FullName: string; Mixed: string | null; Quoted: number | null; LateAdd: string | null }>
	>(),
)
const _k3 = await mixedDb.query(`insert into users (fullname) values ('b') returning ID, mixed, MIXED as m`)
expectType<typeof _k3>(toBe<Array<{ id: number; Mixed: string | null; m: string | null }>>())
// PostgreSQL: an unquoted name is lower case, a quoted one keeps its case (unchanged)
const _pgKeys = await sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id integer primary key, "Mixed" text);`)
	.database()
	.query(`select ID, "Mixed" from t`)
expectType<typeof _pgKeys>(toBe<Array<{ id: number; Mixed: string | null }>>())

// #172: CREATE TABLE IF NOT EXISTS on an existing table still reads (and checks) the statement; the table is kept
const kept = pg.apply(`create table if not exists y as select 1 as a; create table if not exists y (a int, b text);`)
await kept.database().query(`insert into y values (1, 2, 't')`)
const badIfNotExists = `create table if not exists y (a int, a text);` as const
// @ts-expect-error 3208
pg.apply(badIfNotExists)
expectType<GetApplyError<typeof pg, typeof badIfNotExists>>(toBe<DbtyperError<3208, "Column a already exists">>())

// a trailing comma and a second PRIMARY KEY are errors (both engines reject them)
const trailing = `create table x (a int,);` as const
// @ts-expect-error 1520
pg.apply(trailing)
expectType<GetApplyError<typeof pg, typeof trailing>>(
	toBe<DbtyperError<1520, "Expected a column or a table constraint after `,` in CREATE TABLE">>(),
)
const trailingAfterConstraint = `create table x (a int, primary key (a),);` as const
// @ts-expect-error 1520
lite.apply(trailingAfterConstraint)
const twoPks = `create table x (a int primary key, b int primary key);` as const
// @ts-expect-error 1519
pg.apply(twoPks)
expectType<GetApplyError<typeof pg, typeof twoPks>>(
	toBe<DbtyperError<1519, "Multiple primary keys for table x are not allowed">>(),
)
const twoTablePks = `create table x (a int, b int, primary key (a), primary key (b));` as const
// @ts-expect-error 1519
lite.apply(twoTablePks)
const inlineAndTablePk = `create table x (a int primary key, b int, primary key (a, b));` as const
// @ts-expect-error 1519
pg.apply(inlineAndTablePk)
pg.apply(`create table x (a int, b int, primary key (a, b));`)

// duplicate names in a view's column list (both engines reject them)
const dupView = `create view dv (a, a) as select id, title from y;` as const
// @ts-expect-error 3911
pg.apply(dupView)
expectType<GetApplyError<typeof pg, typeof dupView>>(
	toBe<DbtyperError<3911, "CREATE VIEW dv: column a is named more than once in the column list">>(),
)
// @ts-expect-error 3911
lite.apply(dupView)

// lexer: a non-ASCII letter or `$` in an unquoted name, form feed as whitespace, an unclosed block comment
const names = pg.apply(`create table імя (назва text, col$1 int);`).database()
const _names = await names.query(`select назва, col$1 from\fімя`)
expectType<typeof _names>(toBe<Array<{ назва: string | null; col$1: number | null }>>())
const unclosed = `select 1 as a; /* no end` as const
// @ts-expect-error 1011
await pgDb.query(unclosed)

type Code<E> = E extends DbtyperError<infer C, string> ? C : E
expectType<Code<GetQueryError<typeof pgDb, typeof unclosed>>>(toBe<1011>())
expectType<Code<GetApplyError<typeof lite, typeof trailingAfterConstraint>>>(toBe<1520>())
expectType<Code<GetApplyError<typeof lite, typeof twoTablePks>>>(toBe<1519>())
expectType<Code<GetApplyError<typeof pg, typeof inlineAndTablePk>>>(toBe<1519>())
expectType<Code<GetApplyError<typeof lite, typeof dupView>>>(toBe<3911>())
const wrongOrder = `insert into y values (1, 't', 2)` as const
expectType<Code<GetQueryError<typeof pgDb, typeof wrongOrder>>>(toBe<2507>())
expectType<Code<GetQueryError<typeof liteDb, typeof wrongOrder>>>(toBe<2510>())
