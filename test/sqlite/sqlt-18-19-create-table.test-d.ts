// SQLT-18, SQLT-19: SQLite CREATE TABLE forms: generated columns, ON CONFLICT, table options, defaults.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteDriver })

// SQLT-18: WITHOUT ROWID needs a PRIMARY KEY
const noPk = `create table g (a integer not null, b integer as (a * 2) stored) strict, without rowid;` as const
// @ts-expect-error
migrations.apply(noPk)
expectType<GetApplyError<typeof migrations, typeof noPk>>(
	toBe<DbtyperError<1913, "WITHOUT ROWID tables need a PRIMARY KEY">>(),
)

// SQLT-18: with a PRIMARY KEY it is applied, the short generated column is read-only (CORE-18)
const withPk = migrations
	.apply(
		`create table g (a integer primary key, b integer as (a * 2) stored, c integer generated always as (a) virtual) strict, without rowid;`,
	)
	.database()
const _g = await withPk.query(`select a, b, c from g`)
expectType<typeof _g>(toBe<Array<{ a: number; b: number | null; c: number | null }>>())
const _gIns = await withPk.query(`insert into g (a) values (1) returning a`)
expectType<typeof _gIns>(toBe<Array<{ a: number }>>())
const gSet = `insert into g (a, b) values (1, 2);` as const
// @ts-expect-error
withPk.query(gSet)

// SQLT-18: table options in either order; a table constraint PRIMARY KEY counts
const orders = migrations.apply(`create table o (a integer, primary key (a)) without rowid, strict;`).database()
const _o = await orders.query(`select a from o`)
expectType<typeof _o>(toBe<Array<{ a: number }>>())

// SQLT-18: ON CONFLICT on column and table constraints, ASC/DESC after PRIMARY KEY, TEMP, IF NOT EXISTS
const conflicts = migrations
	.apply(
		`create table c (
			id integer primary key asc on conflict replace,
			n text not null on conflict ignore,
			u text unique on conflict fail,
			v integer,
			unique (u, v) on conflict replace
		);
		create temp table if not exists c2 (a int);`,
	)
	.database()
const _c = await conflicts.query(`select id, n, u from c`)
expectType<typeof _c>(toBe<Array<{ id: number; n: string; u: string | null }>>())

// SQLT-19: defaults
const defaults = migrations
	.apply(
		`create table e (id integer primary key, at text not null default current_timestamp, d text default (date('now')), n integer not null default (1 + 2), s text default 'x');`,
	)
	.database()
const _ins = await defaults.query(`insert into e (d) values ('2020-01-01') returning at, id`)
expectType<typeof _ins>(toBe<Array<{ at: string; id: number }>>())
