// Integration Test: CORE-19 DROP VIEW [IF EXISTS] removes the view, its name is free again
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id int not null);`)
	.apply(`create view v1 as select id from t;`)
	.apply(`create view v2 as select id from t;`)
	.apply(`drop view v1;`)
	.apply(`drop view if exists v2; drop view if exists ghost;`)
	.apply(`create table v1 (x text not null);`)
	.database()

// ✅ SUCCESS: CORE-19 a table can take the name of the dropped view
const _result = await _db.query(`select x from v1;`)

expectType<typeof _result>(toBe<{ x: string }[]>())
