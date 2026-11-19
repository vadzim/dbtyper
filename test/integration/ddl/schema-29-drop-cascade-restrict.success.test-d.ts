// Integration Test: SCHEMA-29 DROP TABLE / TYPE / VIEW accept CASCADE | RESTRICT; DROP is one grammar for all three,
// so a keyword-named relation can be dropped too
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id int not null); create table u (id int not null); create table w (id int not null);`)
	.apply(`create table "user" (name text not null);`)
	.apply(`create type e as enum ('a'); create type f as enum ('b');`)
	.apply(`create view v as select id from t;`)
	.apply(`drop table t cascade; drop table if exists u restrict; drop table w;`)
	.apply(`drop type e cascade; drop type if exists f restrict; drop view v cascade;`)
	.apply(`create table t (x text not null); create type e as enum ('c');`)
	.database()

// ✅ SUCCESS: SCHEMA-29 the tables, types and view are gone, so their names are free again
const _result = await _db.query(`select x from t;`)

expectType<typeof _result>(toBe<{ x: string }[]>())
