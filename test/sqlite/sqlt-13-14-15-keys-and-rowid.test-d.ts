// SQLT-13, SQLT-14, SQLT-15: INTEGER PRIMARY KEY is the rowid; other primary keys are nullable unless the table says so.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer primary key, name text not null);`)
	.apply(`create table k (code text primary key);`)
	.apply(`create table ks (code text primary key) strict;`)
	.apply(`create table kw (code text primary key) without rowid;`)
	.apply(`create table kn (code text primary key not null);`)
	.apply(`create table kc (a integer, b integer, primary key (a, b));`)
	.apply(`create table ki (id int primary key);`)
	.apply(`create table kt (id integer, n text, primary key (id));`)
	.database()

// SQLT-13: the rowid alias is non-null and optional in INSERT
const _ins = await db.query(`insert into users (name) values ('a') returning id`)
expectType<typeof _ins>(toBe<Array<{ id: number }>>())

// SQLT-13: a one-column table constraint on an INTEGER column is the rowid too
const _kt = await db.query(`insert into kt (n) values (null) returning id`)
expectType<typeof _kt>(toBe<Array<{ id: number }>>())

// SQLT-14
const _k = await db.query(`select code from k`)
expectType<typeof _k>(toBe<Array<{ code: string | null }>>())
const _ks = await db.query(`select code from ks`)
expectType<typeof _ks>(toBe<Array<{ code: string }>>())
const _kw = await db.query(`select code from kw`)
expectType<typeof _kw>(toBe<Array<{ code: string }>>())
const _kn = await db.query(`select code from kn`)
expectType<typeof _kn>(toBe<Array<{ code: string }>>())
// composite keys and `INT PRIMARY KEY` are not the rowid
const _kc = await db.query(`select a, b from kc`)
expectType<typeof _kc>(toBe<Array<{ a: number | null; b: number | null }>>())
const _ki = await db.query(`select id from ki`)
expectType<typeof _ki>(toBe<Array<{ id: number | null }>>())

// SQLT-15: rowid, oid and _rowid_ are selectable, not part of `*`
const _rowid = await db.query(`select rowid as a, oid as b, _rowid_ as c, u.rowid as r2 from users u`)
expectType<typeof _rowid>(toBe<Array<{ a: number; b: number; c: number; r2: number }>>())
const _star = await db.query(`select * from users`)
expectType<typeof _star>(toBe<Array<{ id: number; name: string }>>())
const _starAlias = await db.query(`select u.* from users u`)
expectType<typeof _starAlias>(toBe<Array<{ id: number; name: string }>>())
const _where = await db.query(`select name from users where rowid = 1`)
expectType<typeof _where>(toBe<Array<{ name: string }>>())

// SQLT-15: in a WITHOUT ROWID table they are unknown columns
const _noRowidQuery = `select rowid from kw` as const
// @ts-expect-error
db.query(_noRowidQuery)

// SQLT-15: a real column of that name wins
const named = sqlMigrations({ driver: sqliteDriver }).apply(`create table r (rowid text not null);`).database()
const _named = await named.query(`select rowid from r`)
expectType<typeof _named>(toBe<Array<{ rowid: string }>>())

// SQLT-15: an unaliased rowid/oid/_rowid_ on a table with an INTEGER PRIMARY KEY is keyed by that column's name
const _rowidKey = await db.query(`select rowid, u.rowid as r from users u`)
expectType<typeof _rowidKey>(toBe<Array<{ id: number; r: number }>>())
const _rowidAlias = await db.query(`select rowid as r from users`)
expectType<typeof _rowidAlias>(toBe<Array<{ r: number }>>())
// without one the key is the word as written
const _rowidPlain = await sqlMigrations({ driver: sqliteDriver })
	.apply(`create table u (n text);`)
	.database()
	.query(`select rowid, n from u`)
expectType<typeof _rowidPlain>(toBe<Array<{ rowid: number; n: string | null }>>())
