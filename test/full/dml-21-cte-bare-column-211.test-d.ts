// DML-21 Check: a bare CTE column inside INSERT / UPDATE / DELETE is an unknown column.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"

const tables = `create table users (id text not null, name text not null, email text);`
const _pg = sqlMigrations({ driver: mockDriver }).apply(tables).database()
const _lite = sqlMigrations({ driver: sqliteDriver }).apply(tables).database()
type P1 = GetQueryError<typeof _pg, "with c as (select 1 as v) update users set name = 'x' where v = 1;">
type P2 = GetQueryError<typeof _pg, "with c as (select 1 as v) delete from users where v = 1;">
type P3 = GetQueryError<typeof _pg, "with c as (select 1 as v) insert into users (id, name) values (v, 'x');">
type L1 = GetQueryError<typeof _lite, "with c as (select 1 as v) update users set name = 'x' where v = 1;">
type L2 = GetQueryError<typeof _lite, "with c as (select 1 as v) delete from users where v = 1;">
type L3 = GetQueryError<typeof _lite, "with c as (select 1 as v) insert into users (id, name) values (v, 'x');">
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
expectType<P1>(toBe<DbtyperError<2300, "Unknown column v in WHERE">>())
expectType<P2>(toBe<DbtyperError<2300, "Unknown column v in WHERE">>())
expectType<P3>(toBe<DbtyperError<2300, "Unknown column v in INSERT VALUES">>())
expectType<L1>(toBe<DbtyperError<2300, "Unknown column v in WHERE">>())
expectType<L2>(toBe<DbtyperError<2300, "Unknown column v in WHERE">>())
expectType<L3>(toBe<DbtyperError<2300, "Unknown column v in INSERT VALUES">>())
