// SQLT-53 (DSEL-5, DSEL-7): PostgreSQL-only syntax is a compile error in a SQLite chain, naming the construct.
import { sqlMigrations, type GetQueryError, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver, mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer primary key, name text not null, tags text);`)
	.database()
const _migrations = sqlMigrations({ driver: sqliteDriver })

type Q<S extends string> = GetQueryError<typeof lite, S>
type M<S extends string> = GetApplyError<typeof _migrations, S>
type E<Name extends string, Hint extends string = ""> = DbtyperError<
	1900,
	`${Name} is PostgreSQL-only; this database is SQLite${Hint extends "" ? "" : `. ${Hint}`}`
>

// the Check of SQLT-53
expectType<Q<`select * from users where name ilike 'a%'`>>(
	toBe<E<"ILIKE", "In SQLite LIKE is already case-insensitive">>(),
)

// queries
expectType<Q<`select $1 as x`>>(toBe<E<"`$n` positional parameter", "Use ? or ?NNN">>())
expectType<Q<`select array[1, 2] as x`>>(toBe<E<"`ARRAY[…]`", "Use json_array(…)">>())
expectType<Q<`select id from users where id = any (select id from users)`>>(
	toBe<E<"`ANY`/`ALL`/`SOME` comparison", "Use IN (…) or a subquery with EXISTS">>(),
)
expectType<Q<`select id from users where id > all (select id from users)`>>(
	toBe<E<"`ANY`/`ALL`/`SOME` comparison", "Use IN (…) or a subquery with EXISTS">>(),
)
expectType<Q<`select id from users where id = some (select id from users)`>>(
	toBe<E<"`ANY`/`ALL`/`SOME` comparison", "Use IN (…) or a subquery with EXISTS">>(),
)
expectType<Q<`select distinct on (name) id from users`>>(toBe<E<"DISTINCT ON", "Use a window function or GROUP BY">>())
expectType<Q<`select id from users where tags @> 'x'`>>(toBe<E<"`@>` operator", "Use json_each(…)">>())
expectType<Q<`select id from users where tags <@ 'x'`>>(toBe<E<"`<@` operator", "Use json_each(…)">>())
expectType<Q<`select id from users where tags && 'x'`>>(toBe<E<"`&&` operator", "Use json_each(…)">>())
expectType<Q<`select u.id from users u, lateral (select 1) x`>>(toBe<E<"LATERAL", "Use a correlated subquery">>())
expectType<Q<`select id from users fetch first 1 rows only`>>(toBe<E<"FETCH FIRST", "Use LIMIT">>())
expectType<Q<`select id::text as x from users`>>(toBe<E<"`::` cast", "Use CAST(x AS TEXT)">>())
expectType<Q<`select cast(name as jsonb) as x from users`>>(toBe<E<"`jsonb` type", "Use TEXT or JSON">>())
expectType<Q<`delete from users using users u2 where users.id = u2.id`>>(toBe<E<"DELETE … USING", "Use a subquery">>())

// migrations
expectType<M<`create type mood as enum ('a');`>>(toBe<E<"CREATE TYPE", "Use TEXT with a CHECK constraint">>())
expectType<M<`create schema s;`>>(toBe<E<"CREATE SCHEMA", "SQLite has no schemas">>())
expectType<M<`create extension pgcrypto;`>>(toBe<E<"CREATE EXTENSION">>())
expectType<M<`grant select on users to bob;`>>(toBe<E<"GRANT", "SQLite has no users or privileges">>())
expectType<M<`create table a (id integer primary key, v timestamptz);`>>(
	toBe<E<"`timestamptz` type", "Use TEXT (ISO 8601) or INTEGER (unix time)">>(),
)
expectType<M<`create table a (id integer primary key, v jsonb);`>>(toBe<E<"`jsonb` type", "Use TEXT or JSON">>())
expectType<M<`create table a (id integer primary key, v uuid);`>>(toBe<E<"`uuid` type", "Use TEXT">>())
expectType<M<`create table a (id integer primary key, v bytea);`>>(toBe<E<"`bytea` type", "Use BLOB">>())
expectType<M<`create table a (id integer primary key, v text[]);`>>(
	toBe<E<"Array type `T[]`", "Use a JSON TEXT column">>(),
)
expectType<M<`create table a (id serial primary key);`>>(toBe<E<"SERIAL type", "Use INTEGER PRIMARY KEY">>())
expectType<M<`insert into users (id, name) values (1, 'a') on conflict on constraint k do nothing;`>>(
	toBe<E<"ON CONFLICT ON CONSTRAINT", "Use ON CONFLICT (columns)">>(),
)

// the same SQL is fine in PostgreSQL, and SQLite's own forms stay accepted
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer primary key, name text not null);`)
	.database()
const _pgIlike = await pg.query(`select id from users where name ilike 'a%'`)
expectType<typeof _pgIlike>(toBe<Array<{ id: number }>>())
const _pgAny = await pg.query(`select id from users where id = any (array[1, 2])`)
expectType<typeof _pgAny>(toBe<Array<{ id: number }>>())

const _liteOk = await lite.query(
	`select id from users where name like 'a%' and id in (select id from users) union all select 1`,
)
expectType<typeof _liteOk>(toBe<Array<{ id: number }>>())
const _liteAny = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table a (id integer primary key, v any);`)
	.database()
void _liteAny
