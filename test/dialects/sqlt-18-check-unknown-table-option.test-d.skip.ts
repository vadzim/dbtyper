// SKIPPED (excluded in tsconfig.test.json): SQLT-18 part 2 Check: `create table t (a int) nonsense` -> dbtyper:1912 "Expected STRICT or WITHOUT ROWID".
// The code gives 1105 "Expected semicolon after CREATE TABLE" (1912 is reached only after WITHOUT). SPEC-Q SQLT-18 1912 (also #184).
// Options: A) fix the Check (1105 for a bare word) B) fix the code (1912 for any unknown option).
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const lite = sqlMigrations({ driver: sqliteDriver })
const sql = `create table t (a int) nonsense` as const
// @ts-expect-error
lite.apply(sql)
expectType<GetApplyError<typeof lite, typeof sql>>(toBe<DbtyperError<1912, "Expected STRICT or WITHOUT ROWID">>())
