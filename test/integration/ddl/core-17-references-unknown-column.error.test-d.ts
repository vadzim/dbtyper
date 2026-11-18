// Integration Test: CORE-17 a REFERENCES target column that does not exist (table-level FOREIGN KEY)
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table b (id integer primary key);`)

// ❌ ERROR: CORE-17 b has no column nope
const query = `create table t (g integer, foreign key (g) references b (nope));` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2300, "Unknown column nope in REFERENCES">>())
