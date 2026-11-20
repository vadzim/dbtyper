// SQLT-73: `INDEXED BY <index>` / `NOT INDEXED` after a table; SQLT-74: SQLite keeps index names (#206).
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const usersTable = `create table users (id integer primary key, name text not null, email text);`

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(usersTable)
	.apply(`create index users_name on users (name);`)
	.apply(`create table posts (id integer primary key); create index posts_id on posts (id);`)
	.database()
type Q<S extends string> = GetQueryError<typeof db, S>

// the Check of SQLT-73
const _a = await db.query(`select id from users indexed by users_name where name = 'a'`)
expectType<typeof _a>(toBe<Array<{ id: number }>>())
const _b = await db.query(`select u.id from users as u indexed by users_name`)
expectType<typeof _b>(toBe<Array<{ id: number }>>())
const _c = await db.query(`select u.name from users u not indexed join users v not indexed on v.id = u.id`)
expectType<typeof _c>(toBe<Array<{ name: string }>>())
const _d = await db.query(`update users indexed by users_name set email = null where name = 'a'`)
expectType<typeof _d>(toBe<[]>())
const _e = await db.query(`delete from users not indexed where id = 1 returning id`)
expectType<typeof _e>(toBe<Array<{ id: number }>>())
expectType<Q<`select id from users indexed by ghost`>>(toBe<DbtyperError<2221, "Unknown index ghost on table users">>())
expectType<Q<`select id from users indexed by posts_id`>>(
	toBe<DbtyperError<2221, "Unknown index posts_id on table users">>(),
)
expectType<Q<`with c as (select id from users) select id from c indexed by users_name`>>(
	toBe<DbtyperError<2221, "Unknown index users_name on table c">>(),
)

// more of SQLT-73: names match per SQLT-27, an UPDATE / DELETE alias before the hint, a view, a missing name
const _f = await db.query(`select id from users INDEXED BY Users_Name`)
expectType<typeof _f>(toBe<Array<{ id: number }>>())
const _g = await db.query(`update users as u not indexed set email = null where u.id = 1`)
expectType<typeof _g>(toBe<[]>())
const _h = await db.query(`delete from users as u indexed by users_name where u.name = 'a'`)
expectType<typeof _h>(toBe<[]>())
const _i = await db.query(`select p.id from posts p indexed by posts_id join users not indexed on users.id = p.id`)
expectType<typeof _i>(toBe<Array<{ id: number }>>())
const _withView = sqlMigrations({ driver: sqliteDriver })
	.apply(`${usersTable} create index users_name on users (name); create view v as select id from users;`)
	.database()
expectType<GetQueryError<typeof _withView, `select id from v indexed by users_name`>>(
	toBe<DbtyperError<2221, "Unknown index users_name on table v">>(),
)
expectType<Q<`select id from users indexed by`>>(toBe<DbtyperError<1122, "Expected index name after INDEXED BY">>())

// PostgreSQL: the other-dialect error (DSEL-6, DSEL-7)
const _pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer primary key, name text not null, email text);`)
	.apply(`create index users_name on users (name);`)
	.database()
type PgE = DbtyperError<1901, "INDEXED BY is SQLite-only; this database is PostgreSQL. Omit it">
expectType<GetQueryError<typeof _pg, `select id from users indexed by users_name`>>(toBe<PgE>())
expectType<GetQueryError<typeof _pg, `select id from users not indexed`>>(toBe<PgE>())

// the Check of SQLT-74
const m = sqlMigrations({ driver: sqliteDriver }).apply(usersTable)
const i1 = m
	.apply(
		`create unique index if not exists i1 on users (lower(name) collate nocase desc, email) where email is not null`,
	)
	.apply(`create index temp.i2 on users (name)`)
const _j = await i1.database().query(`select id from users indexed by i1`)
expectType<typeof _j>(toBe<Array<{ id: number }>>())
const _k = await i1.database().query(`select id from users indexed by i2`)
expectType<typeof _k>(toBe<Array<{ id: number }>>())
const _dropped = i1.apply(`drop index i1; drop index if exists ghost; drop index ghost;`).database()
expectType<GetQueryError<typeof _dropped, `select id from users indexed by i1`>>(
	toBe<DbtyperError<2221, "Unknown index i1 on table users">>(),
)
const renamed = i1.apply(`alter table users rename to people`)
const _l = await renamed.database().query(`select id from people indexed by i2`)
expectType<typeof _l>(toBe<Array<{ id: number }>>())
const _rebuilt = renamed.apply(`drop table people; create table people (id integer primary key);`).database()
expectType<GetQueryError<typeof _rebuilt, `select id from people indexed by i2`>>(
	toBe<DbtyperError<2221, "Unknown index i2 on table people">>(),
)
expectType<GetApplyError<typeof m, `create index i3 on ghost (a)`>>(
	toBe<DbtyperError<2200, "Unknown table ghost in CREATE INDEX">>(),
)
