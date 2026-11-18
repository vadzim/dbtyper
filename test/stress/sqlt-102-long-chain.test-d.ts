// #102: a long SQLite chain must typecheck (no TS2589) and stay cheap; see InitialDatabase in src/core/sql-database.ts.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const chain = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t1 (id integer primary key, name text not null, v1 integer);`)
	.apply(`create table t2 (id integer primary key, name text not null, v2 integer);`)
	.apply(`create table t3 (id integer primary key, name text not null, v3 integer);`)
	.apply(`create table t4 (id integer primary key, name text not null, v4 integer);`)
	.apply(`create table t5 (id integer primary key, name text not null, v5 integer);`)
	.apply(`create table t6 (id integer primary key, name text not null, v6 integer);`)
	.apply(`create table t7 (id integer primary key, name text not null, v7 integer);`)
	.apply(`create table t8 (id integer primary key, name text not null, v8 integer);`)
	.apply(`create table t9 (id integer primary key, name text not null, v9 integer);`)
	.apply(`create table t10 (id integer primary key, name text not null, v10 integer);`)
	.apply(`create table t11 (id integer primary key, name text not null, v11 integer);`)
	.apply(`create table t12 (id integer primary key, name text not null, v12 integer);`)
	.apply(`create table t13 (id integer primary key, name text not null, v13 integer);`)
	.apply(`create table t14 (id integer primary key, name text not null, v14 integer);`)
	.apply(`create table t15 (id integer primary key, name text not null, v15 integer);`)
	.apply(`create table t16 (id integer primary key, name text not null, v16 integer);`)
	.apply(`create table t17 (id integer primary key, name text not null, v17 integer);`)
	.apply(`create table t18 (id integer primary key, name text not null, v18 integer);`)
	.apply(`create table t19 (id integer primary key, name text not null, v19 integer);`)
	.apply(`create table t20 (id integer primary key, name text not null, v20 integer);`)
	.apply(`create table t21 (id integer primary key, name text not null, v21 integer);`)
	.apply(`create table t22 (id integer primary key, name text not null, v22 integer);`)
	.apply(`create table t23 (id integer primary key, name text not null, v23 integer);`)
	.apply(`create table t24 (id integer primary key, name text not null, v24 integer);`)

const _row = await chain.database().query(`select id, name, v24 from t24`)
expectType<typeof _row>(toBe<Array<{ id: number; name: string; v24: number | null }>>())
