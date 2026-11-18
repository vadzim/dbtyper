// Integration Test: CORE-15 a table constraint names a column that is not declared
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

// ❌ ERROR: CORE-15 ghost is not a column of t
const query = `create table t (id integer, primary key (ghost));` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2300, "Unknown column ghost in PRIMARY KEY">>())
