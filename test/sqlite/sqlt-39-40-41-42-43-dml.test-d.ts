// SQLT-39…SQLT-43: INSERT/UPDATE forms, ON CONFLICT, RETURNING (rowid included), UPDATE FROM and value checks in SQLite.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table users (id integer primary key, name text not null, email text, score real);
		create table posts (id integer primary key, user_id integer not null, title text not null);
		create table notes (a text, b integer);
		create table loose (a integer, b text);`,
	)
	.database()

// SQLT-39: INSERT OR …, REPLACE INTO, UPDATE OR …, DEFAULT VALUES, multi-row VALUES and INSERT … SELECT
const _orReplace = await db.query(`insert or replace into users (id, name) values (1, 'a') returning id`)
expectType<typeof _orReplace>(toBe<Array<{ id: number }>>())
const _orIgnore = await db.query(`insert or ignore into users (id, name) values (1, 'a')`)
expectType<typeof _orIgnore>(toBe<[]>())
const _orAbort = await db.query(`insert or abort into users (name) values ('a')`)
const _orFail = await db.query(`insert or fail into users (name) values ('a')`)
const _orRollback = await db.query(`insert or rollback into users (name) values ('a')`)
const _replaceInto = await db.query(`replace into users (id, name) values (1, 'a')`)
expectType<typeof _replaceInto>(toBe<[]>())
const _updateOr = await db.query(`update or replace users set name = 'x' where id = 1 returning name`)
expectType<typeof _updateOr>(toBe<Array<{ name: string }>>())
const _updateIgnore = await db.query(`update or ignore users set name = :n`, { n: "x" })
const _defaults = await db.query(`insert into notes default values returning a, b`)
expectType<typeof _defaults>(toBe<Array<{ a: string | null; b: number | null }>>())
const _multi = await db.query(`insert into users (id, name) values (1, 'a'), (2, 'b') returning id`)
expectType<typeof _multi>(toBe<Array<{ id: number }>>())
const _fromSelect = await db.query(`insert into users (id, name) select id, title from posts`)
expectType<typeof _fromSelect>(toBe<[]>())
// @ts-expect-error: name is NOT NULL and has no default
db.query(`insert into users default values`)
const badAction = `insert or nothing into users (name) values ('a')` as const
// @ts-expect-error
db.query(badAction)
expectType<GetQueryError<typeof db, typeof badAction>>(
	toBe<DbtyperError<1918, "Expected ABORT, FAIL, IGNORE, REPLACE or ROLLBACK after OR">>(),
)
void [_orAbort, _orFail, _orRollback, _updateIgnore]

// SQLT-40: ON CONFLICT with a target (and WHERE), DO NOTHING, DO UPDATE SET … [WHERE …], several in a row
const _upsert = await db.query(
	`insert into users (id, name) values (1, 'a') on conflict (id) do update set name = excluded.name returning *`,
)
expectType<typeof _upsert>(toBe<Array<{ id: number; name: string; email: string | null; score: number | null }>>())
const _nothing = await db.query(`insert into users (id, name) values (1, 'a') on conflict do nothing returning id`)
expectType<typeof _nothing>(toBe<Array<{ id: number }>>())
const _chain = await db.query(
	`insert into users (id, name, email) values (1, 'a', 'e')
	 on conflict (id) where id > 0 do update set name = excluded.name, email = excluded.email where users.id > 1
	 on conflict (name) do nothing
	 returning id`,
)
expectType<typeof _chain>(toBe<Array<{ id: number }>>())
// excluded.col is typed like the target column
// @ts-expect-error: excluded.score is REAL, name is TEXT
db.query(`insert into users (id, name) values (1, 'a') on conflict (id) do update set name = excluded.score`)
// @ts-expect-error: unknown column in the conflict target
db.query(`insert into users (id, name) values (1, 'a') on conflict (nope) do nothing`)

// SQLT-41: RETURNING on INSERT, UPDATE and DELETE, rowid included (keyed like a select, SQLT-15)
const _retRowid = await db.query(
	`insert into users (name) values ('a') returning rowid as a, oid as b, _rowid_ as c, id`,
)
expectType<typeof _retRowid>(toBe<Array<{ a: number; b: number; c: number; id: number }>>())
const _insertRowid = await db.query(`insert into users (rowid, name) values (5, 'a') returning rowid`)
expectType<typeof _insertRowid>(toBe<Array<{ id: number }>>())
const _updRowid = await db.query(`update users set name = 'b' returning rowid, name`)
expectType<typeof _updRowid>(toBe<Array<{ id: number; name: string }>>())
const _delRows = await db.query(`delete from users where id = 1 returning *`)
expectType<typeof _delRows>(toBe<Array<{ id: number; name: string; email: string | null; score: number | null }>>())
const _delRowid = await db.query(`delete from users returning rowid`)
expectType<typeof _delRowid>(toBe<Array<{ id: number }>>())
// a DML statement inside a CTE or a subquery is a compile error
const dmlInCte = `with c as (insert into users (name) values ('a') returning id) select id from c` as const
// @ts-expect-error
db.query(dmlInCte)
expectType<GetQueryError<typeof db, typeof dmlInCte>>(toBe<DbtyperError<1101, "Expected SELECT in subquery">>())
const dmlInSubquery = `select id from (delete from users returning id)` as const
// @ts-expect-error
db.query(dmlInSubquery)
expectType<GetQueryError<typeof db, typeof dmlInSubquery>>(
	toBe<DbtyperError<1102, "Expected SELECT in derived table">>(),
)

// SQLT-42: UPDATE … FROM (with joins) is typed; DELETE … USING is a compile error with a hint
const _updFrom = await db.query(
	`update users set name = p.title from posts p where p.user_id = users.id returning users.id, p.title`,
)
expectType<typeof _updFrom>(toBe<Array<{ id: number; title: string }>>())
const _updFromJoin = await db.query(
	`update users set email = n.a from posts p join notes n on n.b = p.id where p.user_id = users.id`,
)
expectType<typeof _updFromJoin>(toBe<[]>())
// @ts-expect-error: n.b is INTEGER, name is TEXT
db.query(`update users set name = n.b from notes n where n.a = users.name`)
const usingQuery = `delete from users using posts where posts.user_id = users.id` as const
// @ts-expect-error
db.query(usingQuery)
expectType<GetQueryError<typeof db, typeof usingQuery>>(
	toBe<DbtyperError<1900, "DELETE … USING is PostgreSQL-only; this database is SQLite. Use a subquery">>(),
)

// SQLT-43: a value must match the column's TS type, also in non-STRICT tables (no SQLite type juggling)
const numberForText = `insert into users (name) values (42)` as const
// @ts-expect-error
db.query(numberForText)
expectType<GetQueryError<typeof db, typeof numberForText>>(toBe<DbtyperError<2510, "column `name` is TEXT">>())
// @ts-expect-error
db.query(`insert into loose (a, b) values ('x', 'y')`)
// @ts-expect-error
db.query(`update loose set b = 1`)
const _ok = await db.query(`insert into loose (a, b) values (1, 'y')`)
expectType<typeof _ok>(toBe<[]>())
