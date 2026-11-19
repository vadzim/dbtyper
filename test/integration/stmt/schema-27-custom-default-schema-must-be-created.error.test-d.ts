// Integration Test: SCHEMA-27 a defaultSchema other than public must still be created by a migration
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver, defaultSchema: "app" })

// ❌ ERROR: schema app was never created
const query = `create table t (id int);` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2214, "Unknown schema app for CREATE TABLE">>())
