// STMT-18, STMT-19, STMT-Q2 (#157, #158; review #175 batch 4): the second word of CREATE / ALTER / DROP is checked, a
// leading `(` is a typed query, schema changes dbtyper cannot follow are errors, and one-dialect DDL is gated.
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table users (id integer primary key, name text not null, email text);
	create table posts (id integer primary key, user_id integer not null, title text, body text not null);`
const pg = sqlMigrations({ driver: mockDriver }).apply(schema)
const _lite = sqlMigrations({ driver: sqliteDriver }).apply(schema)
type PgM<S extends string> = GetApplyError<typeof pg, S>
type LiteM<S extends string> = GetApplyError<typeof _lite, S>
type Untyped = ". If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped"
type DidYouMean = "? If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped"

// #158: a typo in the second word is an error, with the closest form
expectType<PgM<`create tabel x (a int);`>>(
	toBe<DbtyperError<1933, `Unknown statement CREATE tabel; did you mean CREATE TABLE${DidYouMean}`>>(),
)
expectType<PgM<`drop tabel users;`>>(
	toBe<DbtyperError<1933, `Unknown statement DROP tabel; did you mean DROP TABLE${DidYouMean}`>>(),
)
expectType<PgM<`alter tabel users add column z int;`>>(
	toBe<DbtyperError<1933, `Unknown statement ALTER tabel; did you mean ALTER TABLE${DidYouMean}`>>(),
)
expectType<PgM<`drop vew v;`>>(toBe<DbtyperError<1936, `Unknown statement DROP vew${Untyped}`>>())
expectType<PgM<`create;`>>(toBe<DbtyperError<1934, "Expected what to CREATE (TABLE, VIEW, INDEX, …)">>())
expectType<PgM<`drop;`>>(toBe<DbtyperError<1934, "Expected what to DROP (TABLE, VIEW, INDEX, …)">>())
// a form skipped in one dialect only is unknown in the other
expectType<LiteM<`create sequence s;`>>(toBe<DbtyperError<1936, `Unknown statement CREATE sequence${Untyped}`>>())

// the skipped forms stay skipped (PGT-21, SQLT-23)
expectType<
	PgM<`create index i on users (id); create unique index j on users (name);
	create or replace function f() returns int as $$ select 1 $$ language sql;
	create trigger t before insert on users for each row execute function f();
	drop index i; alter sequence s restart; create extension if not exists x; alter view v owner to bob;
	alter default privileges grant select on tables to bob; drop owned by bob;`>
>(toBe<null>())
expectType<
	LiteM<`create index i on users (id); create unique index j on users (name);
	create trigger tr after insert on users begin select 1; end; drop index i; drop trigger tr;`>
>(toBe<null>())

// #158: CREATE UNLOGGED TABLE is a table, DROP DOMAIN removes the domain
const unlogged = pg.apply(`create unlogged table x (a int not null);`).database()
const _x = await unlogged.query(`select a from x`)
expectType<typeof _x>(toBe<{ a: number }[]>())
expectType<PgM<`create domain posint as integer; drop domain posint; create domain posint as text;`>>(toBe<null>())
expectType<PgM<`drop domain if exists nope; create type mood as enum ('a');`>>(toBe<null>())
expectType<PgM<`create type mood as enum ('a'); drop domain mood;`>>(
	toBe<DbtyperError<3308, "Type is not a domain; use DROP TYPE">>(),
)

// STMT-Q2: schema changes dbtyper cannot follow are errors, not silent skips
expectType<PgM<`alter view v rename to w;`>>(
	toBe<
		DbtyperError<
			1935,
			"ALTER VIEW … RENAME is not supported: dbtyper cannot follow the schema change it makes. Use DROP VIEW and CREATE VIEW"
		>
	>(),
)
expectType<PgM<`alter schema s rename to t;`>>(
	toBe<
		DbtyperError<
			1935,
			"ALTER SCHEMA … RENAME is not supported: dbtyper cannot follow the schema change it makes. Create the new schema and move the objects"
		>
	>(),
)
expectType<PgM<`create temp table x (a int);`>>(
	toBe<
		DbtyperError<
			1935,
			"CREATE TEMP is not supported: dbtyper cannot follow the schema change it makes. Create a regular table, or run it with queryUntyped outside the migrations"
		>
	>(),
)

// #157: a statement that starts with `(` is typed like the query without the parentheses
const db = pg.database()
const _p1 = await db.query(`(select name from users) union (select body from posts)`)
expectType<typeof _p1>(toBe<{ name: string }[]>())
const _p2 = await db.query(`(select id from users)`)
expectType<typeof _p2>(toBe<{ id: number }[]>())
const _p3 = await db.query(`select name from users union (select body from posts) order by name`)
expectType<typeof _p3>(toBe<{ name: string }[]>())
expectType<GetQueryError<typeof db, `(select nope from nowhere)`>>(
	toBe<DbtyperError<2200, "Unknown table nowhere in FROM">>(),
)
// @ts-expect-error 2200: the parenthesised query is checked
await db.query(`(select nope from nowhere)`)

// SQLite chains: PostgreSQL-only DDL is the other-dialect error (DSEL-5)
type PgOnly<Name extends string, Hint extends string = ""> = DbtyperError<
	1900,
	`${Name} is PostgreSQL-only; this database is SQLite${Hint extends "" ? "" : `. ${Hint}`}`
>
expectType<LiteM<`drop table users, posts;`>>(toBe<PgOnly<"DROP of a name list", "Use one DROP statement per name">>())
expectType<LiteM<`drop table users cascade;`>>(toBe<PgOnly<"CASCADE / RESTRICT">>())
expectType<LiteM<`create or replace view v as select 1 as a;`>>(
	toBe<PgOnly<"CREATE OR REPLACE", "Drop it and create it again">>(),
)
expectType<LiteM<`create materialized view v as select 1 as a;`>>(
	toBe<PgOnly<"MATERIALIZED VIEW", "Use a table or a view">>(),
)
expectType<LiteM<`create unlogged table x (a int);`>>(toBe<PgOnly<"UNLOGGED TABLE", "Use CREATE TABLE">>())
expectType<LiteM<`CREATE DOMAIN d AS integer;`>>(toBe<PgOnly<"DOMAIN", "Use the base type with a CHECK constraint">>())
expectType<LiteM<`alter table if exists users rename to u;`>>(toBe<PgOnly<"ALTER TABLE IF EXISTS">>())
expectType<LiteM<`alter table users owner to bob;`>>(toBe<PgOnly<"OWNER TO / ROW LEVEL SECURITY">>())
expectType<LiteM<`alter table users add column if not exists z text;`>>(toBe<PgOnly<"IF [NOT] EXISTS on a column">>())
expectType<LiteM<`create table d (a text default upper('x'));`>>(
	toBe<PgOnly<"DEFAULT expression without parentheses", "Write DEFAULT (expression)">>(),
)
expectType<LiteM<`create table d (a text default (upper('x')), b integer default -1, c text default 'x');`>>(
	toBe<null>(),
)
