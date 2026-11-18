// Integration Test: CORE-19 after DROP VIEW the view is unknown
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id int not null);`)
	.apply(`create view v1 as select id from t;`)
	.apply(`drop view v1;`)
	.database()

// ❌ ERROR: CORE-19 v1 was dropped
const query = `select id from v1;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2200, "Unknown table v1 in FROM">>())
