// Integration Test: CORE-19 DROP VIEW [IF EXISTS] removes the view
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id int not null);`)
	.apply(`create view v1 as select id from t;`)
	.apply(`create view v2 as select id from t;`)
	.apply(`drop view v1;`)
	.apply(`drop view if exists v2; drop view if exists ghost;`)
const db = migrations.database()

// ✅ SUCCESS: CORE-19 after DROP VIEW the view name is unknown
const query = `select id from v1;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2200, "Unknown table v1 in FROM">>())

// ✅ SUCCESS: CORE-19 the name is free again, a table of that name can be created
const _db2 = migrations.apply(`create table v1 (x text not null);`).database()
const _rows = await _db2.query(`select x from v1;`)
expectType<typeof _rows>(toBe<{ x: string }[]>())
