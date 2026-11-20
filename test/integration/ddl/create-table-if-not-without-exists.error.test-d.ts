// Integration Test: CREATE TABLE IF NOT
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(
	`create table users (id integer not null, name text not null);`,
)

// ❌ ERROR: IF NOT must be followed by EXISTS
const query = `create table if not t2 (id integer);` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1508, "Expected `exists` after `IF NOT` in CREATE TABLE">>())
