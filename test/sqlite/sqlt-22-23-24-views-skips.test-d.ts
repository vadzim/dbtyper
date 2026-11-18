// SQLT-22, SQLT-23, SQLT-24: views, skipped statements, unsupported statements.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteDriver })

// SQLT-22: views, with column list and IF NOT EXISTS, TEMP
const views = migrations
	.apply(
		`create table users (id integer primary key, name text not null, email text);
		create view if not exists v (uid, uname) as select id, name from users;
		create view if not exists v as select email from users;
		create temp view tv as select name from users;`,
	)
	.database()
const _v = await views.query(`select uid, uname from v`)
expectType<typeof _v>(toBe<Array<{ uid: number; uname: string }>>())
const _tv = await views.query(`select name from tv`)
expectType<typeof _tv>(toBe<Array<{ name: string }>>())

// SQLT-22: the rebuild pattern types every step against the schema at that point
const rebuilt = migrations
	.apply(
		`create table old (id integer primary key, a text not null);
		create table fresh (id integer primary key, a text not null, b integer not null default 0);
		insert into fresh (id, a) select id, a from old;
		drop table old;
		alter table fresh rename to old;`,
	)
	.database()
const _old = await rebuilt.query(`select id, a, b from old`)
expectType<typeof _old>(toBe<Array<{ id: number; a: string; b: number }>>())

// SQLT-23: skipped statements; a trigger body with `;` is one statement
const skipped = migrations
	.apply(
		`pragma foreign_keys = on;
		begin transaction;
		create table k (id integer primary key, d text);
		create unique index if not exists k_d on k (d);
		create trigger k_tr after insert on k for each row when new.d is null
		begin
			update k set d = 'x' where id = new.id;
			update k set d = case when d = 'y' then 'z' else d end where id = new.id;
		end;
		drop trigger k_tr;
		drop index k_d;
		create table z (a int);
		savepoint s1; release s1; commit; vacuum; analyze; reindex;`,
	)
	.database()
const _z = await skipped.query(`select a from z`)
expectType<typeof _z>(toBe<Array<{ a: number | null }>>())

// SQLT-24: virtual tables and ATTACH / DETACH are compile errors
const virtual = `create virtual table f using fts5(a);` as const
// @ts-expect-error
migrations.apply(virtual)
expectType<GetApplyError<typeof migrations, typeof virtual>>(
	toBe<DbtyperError<1916, "CREATE VIRTUAL TABLE is not supported in migrations">>(),
)
const attach = `attach database 'x.db' as x;` as const
// @ts-expect-error
migrations.apply(attach)
expectType<GetApplyError<typeof migrations, typeof attach>>(
	toBe<DbtyperError<1916, "ATTACH is not supported in migrations">>(),
)
const detach = `detach x;` as const
// @ts-expect-error
migrations.apply(detach)
