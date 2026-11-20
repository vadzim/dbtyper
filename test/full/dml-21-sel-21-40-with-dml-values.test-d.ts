// DML-21: WITH before INSERT / UPDATE / DELETE; SEL-21: the message after a WITH list; SEL-40: a VALUES CTE body (#206).
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const tables = `create table users (id text not null, name text not null, email text);
	create table users_backup (id text not null, name text not null);`
const pg = sqlMigrations({ driver: mockDriver }).apply(tables).database()
const lite = sqlMigrations({ driver: sqliteDriver }).apply(tables).database()
type PgQ<S extends string> = GetQueryError<typeof pg, S>
type LiteQ<S extends string> = GetQueryError<typeof lite, S>

// the Check of DML-21, both dialects
const _p1 = await pg.query(
	`with c (i, n) as (values ('1', 'a'), ('2', 'b')) insert into users (id, name) select i, n from c returning id, name;`,
)
expectType<typeof _p1>(toBe<Array<{ id: string; name: string }>>())
const _l1 = await lite.query(
	`with c (i, n) as (values ('1', 'a'), ('2', 'b')) insert into users (id, name) select i, n from c returning id, name;`,
)
expectType<typeof _l1>(toBe<Array<{ id: string; name: string }>>())
const _p2 = await pg.query(
	`with c as (select id from users_backup where name = 'x') update users set email = null where id in (select id from c) returning id, email;`,
)
expectType<typeof _p2>(toBe<Array<{ id: string; email: string | null }>>())
const _l2 = await lite.query(
	`with c as (select id from users_backup where name = 'x') update users set email = null where id in (select id from c) returning id, email;`,
)
expectType<typeof _l2>(toBe<Array<{ id: string; email: string | null }>>())
const _p3 = await pg.query(`with c as (select id from users_backup) delete from users where id in (select id from c);`)
expectType<typeof _p3>(toBe<[]>())
const _l3 = await lite.query(
	`with c as (select id from users_backup) delete from users where id in (select id from c);`,
)
expectType<typeof _l3>(toBe<[]>())
const _p4 = await pg.query(`with users as (select 1 as x) delete from users returning id;`)
expectType<typeof _p4>(toBe<Array<{ id: string }>>())
const _l4 = await lite.query(`with users as (select 1 as x) delete from users returning id;`)
expectType<typeof _l4>(toBe<Array<{ id: string }>>())
type InsertIntoCte = `with c as (select id, name from users_backup) insert into c (id, name) values ('1', 'a');`
expectType<PgQ<InsertIntoCte>>(toBe<DbtyperError<2200, "Unknown table c in INSERT INTO">>())
expectType<LiteQ<InsertIntoCte>>(toBe<DbtyperError<2200, "Unknown table c in INSERT INTO">>())
type MissingName = `with c (i) as (values ('1')) insert into users (id) select i from c;`
expectType<PgQ<MissingName>>(toBe<DbtyperError<3300, "Missing NOT NULL column name in INSERT">>())
expectType<LiteQ<MissingName>>(toBe<DbtyperError<3300, "Missing NOT NULL column name in INSERT">>())
type Ghost = `with c (i) as (values ('1')) insert into users (id, name) select i, ghost from c;`
expectType<PgQ<Ghost>["__sql_parser_error_code__"]>(toBe<2300>())
expectType<LiteQ<Ghost>["__sql_parser_error_code__"]>(toBe<2300>())
type DmlCte =
	`with x as (delete from users_backup returning id) update users set email = null where id in (select id from x) returning id;`
const _p5 = await pg.query(
	`with x as (delete from users_backup returning id) update users set email = null where id in (select id from x) returning id;`,
)
expectType<typeof _p5>(toBe<Array<{ id: string }>>())
expectType<LiteQ<DmlCte>>(toBe<DbtyperError<1101, "Expected SELECT in subquery">>())
const _l6 = await lite.query(
	`with c (i, n) as (values ('1', 'a')) insert or replace into users (id, name) select i, n from c;`,
)
expectType<typeof _l6>(toBe<[]>())

// more of DML-21: UPDATE … FROM a CTE, a CTE in SET and RETURNING, WITH RECURSIVE, REPLACE, a CTE name shadowing a column
const _p7 = await pg.query(
	`with c as (select id, name from users_backup) update users set name = c.name from c where users.id = c.id returning users.id;`,
)
expectType<typeof _p7>(toBe<Array<{ id: string }>>())
const _l7 = await lite.query(
	`with c as (select id, name from users_backup) update users set name = (select name from c where c.id = users.id) returning (select count(*) from c) as n;`,
)
expectType<typeof _l7>(toBe<Array<{ n: number | null }>>())
const _l8 = await lite.query(
	`with recursive n (i) as (select 'a' union all select i || 'a' from n where length(i) < 3) delete from users where name in (select i from n);`,
)
expectType<typeof _l8>(toBe<[]>())
const _l9 = await lite.query(`with c (i, n) as (values ('1', 'a')) replace into users (id, name) select i, n from c;`)
expectType<typeof _l9>(toBe<[]>())
const _p10 = await pg.query(`with c as (select id from users_backup) select id from c;`)
expectType<typeof _p10>(toBe<Array<{ id: string }>>())

// the Check of SEL-21
type WithCreate = `with cte as (select 1 as a) create table x (a integer);`
type E1100 = DbtyperError<1100, "Expected SELECT, INSERT, UPDATE or DELETE after WITH clause">
expectType<PgQ<WithCreate>>(toBe<E1100>())
expectType<LiteQ<WithCreate>>(toBe<E1100>())

// `returning *` lists the target only, never a CTE (DML-21)
const _l11 = await lite.query(`with c as (select id from users_backup) delete from users returning *;`)
expectType<typeof _l11>(toBe<Array<{ id: string; name: string; email: string | null }>>())

// the Check of SEL-40, both dialects
const _v1 = await pg.query(`with v as (values (1, 'a'), (2, null)) select column1, column2 from v`)
expectType<typeof _v1>(toBe<Array<{ column1: number; column2: string | null }>>())
const _v1l = await lite.query(`with v as (values (1, 'a'), (2, null)) select column1, column2 from v`)
expectType<typeof _v1l>(toBe<Array<{ column1: number; column2: string | null }>>())
const _v2 = await pg.query(`with v (n, s) as (values (1, 'a')) select n, s from v`)
expectType<typeof _v2>(toBe<Array<{ n: number; s: string }>>())
const _v2l = await lite.query(`with v (n, s) as (values (1, 'a')) select n, s from v`)
expectType<typeof _v2l>(toBe<Array<{ n: number; s: string }>>())
expectType<PgQ<`with v (n) as (values (1, 'a')) select n from v`>["__sql_parser_error_code__"]>(toBe<3413>())
expectType<LiteQ<`with v (n) as (values (1, 'a')) select n from v`>["__sql_parser_error_code__"]>(toBe<3413>())
type E3417 = DbtyperError<3417, "All VALUES rows must have the same number of values">
expectType<PgQ<`with v as (values (1), (2, 3)) select column1 from v`>>(toBe<E3417>())
expectType<LiteQ<`with v as (values (1), (2, 3)) select column1 from v`>>(toBe<E3417>())
type E3409 = DbtyperError<3409, "Incompatible types in VALUES for column column1">
expectType<PgQ<`with v as (values (1), ('a')) select column1 from v`>>(toBe<E3409>())
expectType<LiteQ<`with v as (values (1), ('a')) select column1 from v`>>(toBe<E3409>())
const _v3 = await pg.query(`with v as (values (:a, 'x'), (1, 'y')) select column1, column2 from v`, { a: 1 })
expectType<typeof _v3>(toBe<Array<{ column1: number; column2: string }>>())
const _v3l = await lite.query(`with v as (values (:a, 'x'), (1, 'y')) select column1, column2 from v`, { a: 1 })
expectType<typeof _v3l>(toBe<Array<{ column1: number; column2: string }>>())
// @ts-expect-error SEL-40: the parameter is a number
await lite.query(`with v as (values (:a, 'x'), (1, 'y')) select column1, column2 from v`, { a: "1" })
expectType<
	GetQueryError<
		typeof lite,
		`with v as (values (:a), (null)) select column1 from v`,
		{ a: 1 }
	>["__sql_parser_error_code__"]
>(toBe<2405>())
const _v4 = await pg.query(`with v as (values (cast(:a as text))) select column1 from v`, { a: "x" })
expectType<typeof _v4>(toBe<Array<{ column1: string }>>())
const _v4l = await lite.query(`with v as (values (cast(:a as text))) select column1 from v`, { a: "x" })
expectType<typeof _v4l>(toBe<Array<{ column1: string }>>())
expectType<PgQ<`with v as (values (name)) select column1 from v`>["__sql_parser_error_code__"]>(toBe<2300>())
expectType<LiteQ<`with v as (values (name)) select column1 from v`>["__sql_parser_error_code__"]>(toBe<2300>())

// SEL-40: a malformed VALUES body
expectType<LiteQ<`with v as (values 1) select column1 from v`>>(
	toBe<DbtyperError<1123, "Expected `(` before a VALUES row">>(),
)
expectType<PgQ<`with v as (values (1 2)) select column1 from v`>>(
	toBe<DbtyperError<1124, "Expected `,` or `)` in a VALUES row">>(),
)
