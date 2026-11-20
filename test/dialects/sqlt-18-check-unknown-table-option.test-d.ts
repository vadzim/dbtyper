// Integration Test: SQLT-18 part 2 Check (verification/sqlite.md @ 2a941c8): an unknown table option after `)` is dbtyper:1912.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
const sql = `create table t (a int) nonsense` as const
// @ts-expect-error
lite.apply(sql)
expectType<GetApplyError<typeof lite, typeof sql>>(toBe<DbtyperError<1912, "Expected STRICT or WITHOUT ROWID">>())
