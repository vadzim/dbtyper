// Integration Test: CORE-18 Check: SQLite insert into b is 3512
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { sqliteDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (a integer not null, b integer as (a * 2) stored)`)
	.database()

// ❌ ERROR: CORE-18
const query = `insert into t (a, b) values (1, 2)` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3512, "Cannot write generated column b in INSERT">>())
