// TYPE-18 (#179 item 4): DROP DOMAIN / DROP TYPE of a domain or composite type a column uses is 3212; CASCADE drops
// the columns. PostgreSQL drops a table's constraints that involve a dropped column (DROP COLUMN, CASCADE or not).
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Code<E> = E extends DbtyperError<infer C, string> ? C : E
/** The unknown-constraint error of an INSERT (its error type also lists the stream variants). */
type UnknownConstraint<E> = Extract<E, DbtyperError<2220, `Unknown constraint ${string}`>>

const base = sqlMigrations({ driver: mockDriver }).apply(
	`create domain email as text not null;
	 create type point2 as (x integer, y integer);
	 create table t (id integer primary key, e email, p point2, ps point2[], n integer not null,
		 constraint t_e_uniq unique (e), constraint t_n_pos check (n > 0 and e <> ''));
	 create table u (id integer not null, e email constraint u_e_check check (e <> ''));`,
)

// in use: 3212, also under IF EXISTS and RESTRICT
expectType<Code<GetApplyError<typeof base, `drop domain email;`>>>(toBe<3212>())
expectType<Code<GetApplyError<typeof base, `drop domain if exists email restrict;`>>>(toBe<3212>())
expectType<Code<GetApplyError<typeof base, `drop type point2;`>>>(toBe<3212>())
// @ts-expect-error 3212
base.apply(`drop domain email;`)

// CASCADE drops the columns of the type, in every table
const noEmail = base.apply(`drop domain email cascade;`).database()
const _t = await noEmail.query(`select id, n from t`)
expectType<typeof _t>(toBe<Array<{ id: number; n: number }>>())
expectType<Code<GetQueryError<typeof noEmail, `select e from t`>>>(toBe<2300>())
expectType<Code<GetQueryError<typeof noEmail, `select e from u`>>>(toBe<2300>())
// … and the named constraints that involve them
expectType<
	UnknownConstraint<
		GetQueryError<
			typeof noEmail,
			`insert into t (id, n) values (1, 1) on conflict on constraint t_e_uniq do nothing`
		>
	>
>(toBe<DbtyperError<2220, "Unknown constraint t_e_uniq on table t">>())
expectType<
	UnknownConstraint<
		GetQueryError<
			typeof noEmail,
			`insert into t (id, n) values (1, 1) on conflict on constraint t_n_pos do nothing`
		>
	>
>(toBe<DbtyperError<2220, "Unknown constraint t_n_pos on table t">>())
const noPoint = base.apply(`drop type point2 cascade;`).database()
const _tp = await noPoint.query(`select * from t`)
expectType<typeof _tp>(toBe<Array<{ id: number; e: string; n: number }>>())

// a type nobody uses, or after its columns are gone, drops fine
base.apply(`alter table t drop column e; drop table u; drop domain email;`)
base.apply(`alter table t drop column p, drop column ps; drop type point2;`)
sqlMigrations({ driver: mockDriver }).apply(
	`create domain d as integer; create type c as (a int); drop domain d; drop type c;`,
)

// DROP COLUMN drops the named constraints that involve the column; the others stay
const dropped = base.apply(`alter table t drop column n;`).database()
expectType<
	UnknownConstraint<
		GetQueryError<
			typeof dropped,
			`insert into t (id, e) values (1, 'a') on conflict on constraint t_n_pos do nothing`
		>
	>
>(toBe<DbtyperError<2220, "Unknown constraint t_n_pos on table t">>())
const _kept = await dropped.query(`insert into t (id, e) values (1, 'a') on conflict on constraint t_e_uniq do nothing`)
expectType<typeof _kept>(toBe<[]>())
// constraints added by ALTER TABLE, and a renamed column keeps its constraints
const altered = sqlMigrations({ driver: mockDriver }).apply(
	`create table v (a integer not null, b integer not null, c integer not null);
		 alter table v add constraint v_ab unique (a, b), add constraint v_c check (c > 0), add column d integer constraint v_d unique;
		 alter table v rename column a to a2;`,
)
const _v = await altered
	.database()
	.query(`insert into v (a2, b, c) values (1, 1, 1) on conflict on constraint v_ab do nothing`)
expectType<typeof _v>(toBe<[]>())
const _alteredDrop = altered.apply(`alter table v drop column a2, drop column c, drop column d;`).database()
expectType<
	UnknownConstraint<
		GetQueryError<typeof _alteredDrop, `insert into v (b) values (1) on conflict on constraint v_ab do nothing`>
	>
>(toBe<DbtyperError<2220, "Unknown constraint v_ab on table v">>())
expectType<
	UnknownConstraint<
		GetQueryError<typeof _alteredDrop, `insert into v (b) values (1) on conflict on constraint v_c do nothing`>
	>
>(toBe<DbtyperError<2220, "Unknown constraint v_c on table v">>())
expectType<
	UnknownConstraint<
		GetQueryError<typeof _alteredDrop, `insert into v (b) values (1) on conflict on constraint v_d do nothing`>
	>
>(toBe<DbtyperError<2220, "Unknown constraint v_d on table v">>())
