// Integration Test: CREATE TABLE constraint
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(
	`create table users (id integer not null, name text not null);`,
)

// ❌ ERROR: CONSTRAINT without a name
const query = `create table t2 (id integer, constraint primary key (id));` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1515, "Expected constraint name after CONSTRAINT in CREATE TABLE">>())
