// SCHEMA-21, SCHEMA-23, SCHEMA-29, PGT-19, CORE-16, CORE-17 (#154, #165; review #175 batch 4): ALTER TABLE checks what
// CREATE TABLE checks, idempotent column forms, DROP lists and CASCADE (PostgreSQL).
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const base = sqlMigrations({ driver: mockDriver }).apply(
	`create table users (id integer primary key, name text not null, email text);
	create table posts (id integer primary key, user_id integer not null, title text);`,
)
type M<S extends string> = GetApplyError<typeof base, S>

// #154: ALTER COLUMN of a missing column is an error and the table stays
expectType<M<`alter table users alter column nope set not null;`>>(
	toBe<DbtyperError<3209, "Column nope does not exist">>(),
)
expectType<M<`alter table users alter column nope type text;`>>(toBe<DbtyperError<3209, "Column nope does not exist">>())
// @ts-expect-error 3209
base.apply(`alter table users alter column nope drop default;`)

// an ALTER TABLE needs an action
expectType<M<`alter table users;`>>(
	toBe<DbtyperError<1611, "Expected an action (ADD, DROP, RENAME, ALTER, …) in ALTER TABLE">>(),
)

// a type error of ALTER COLUMN … TYPE is reported as such (was the generic 1607)
expectType<M<`alter table users alter column name type varchar(x);`>>(
	toBe<DbtyperError<5101, "Expected number for VARCHAR length">>(),
)

// #165: non-reserved keywords as names in ALTER TABLE
const kw = base
	.apply(`create table type (id integer primary key, key text);`)
	.apply(`alter table type rename column key to view;`)
	.apply(`alter table type add column index integer, alter column view set not null;`)
	.database()
const _kw = await kw.query(`select id, view, index from type`)
expectType<typeof _kw>(toBe<{ id: number; view: string; index: number | null }[]>())

// PGT-19: idempotent column forms and CASCADE
const idem = base
	.apply(`alter table users add column if not exists email text, add column if not exists age integer;`)
	.apply(`alter table users drop column if exists nope, drop column if exists email cascade;`)
	.apply(`alter table posts drop column title restrict;`)
	.database()
const _idem = await idem.query(`select * from users`)
expectType<typeof _idem>(toBe<{ id: number; name: string; age: number | null }[]>())
expectType<M<`alter table users add column if exists z text;`>>(
	toBe<DbtyperError<1612, "Expected NOT EXISTS after `IF` on a column in ALTER TABLE">>(),
)
expectType<M<`alter table users drop column if not exists z;`>>(
	toBe<DbtyperError<1612, "Expected EXISTS after `IF` on a column in ALTER TABLE">>(),
)

// CORE-16, CORE-17: SET DEFAULT and ADD CONSTRAINT are checked as in CREATE TABLE
expectType<M<`alter table users alter column name set default 5;`>>(
	toBe<DbtyperError<2507, "Incompatible value type for column name">>(),
)
expectType<M<`alter table users alter column name set default 'x', alter column email set default null;`>>(toBe<null>())
expectType<M<`alter table users add constraint u unique (nope);`>>(
	toBe<DbtyperError<2300, "Unknown column nope in UNIQUE">>(),
)
expectType<M<`alter table posts add foreign key (user_id) references nope (id);`>>(
	toBe<DbtyperError<2200, "Unknown table nope in REFERENCES">>(),
)
expectType<M<`alter table posts add foreign key (nope) references users (id);`>>(
	toBe<DbtyperError<2300, "Unknown column nope in FOREIGN KEY">>(),
)
expectType<M<`alter table posts add constraint fk foreign key (user_id) references users (id) on delete cascade;`>>(
	toBe<null>(),
)

// SCHEMA-29: DROP of a name list, CASCADE on DROP SCHEMA
const dropped = base
	.apply(`create schema app; create table app.t (a int);`)
	.apply(`drop table users, posts cascade; drop schema app cascade;`)
	.apply(`create table users (x text);`)
	.database()
const _d = await dropped.query(`select x from users`)
expectType<typeof _d>(toBe<{ x: string | null }[]>())
expectType<M<`drop table users, nope;`>>(toBe<DbtyperError<3204, "Table does not exist; use IF EXISTS">>())
expectType<M<`drop table if exists users, nope; create table users (z int);`>>(toBe<null>())
expectType<M<`create type a as enum ('x'); create type b as enum ('y'); drop type a, b; create type a as enum ('z');`>>(
	toBe<null>(),
)
