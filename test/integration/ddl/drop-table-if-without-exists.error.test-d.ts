// Integration Test: DROP TABLE IF
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(
	`create table users (id integer not null, name text not null);`,
)

// ❌ ERROR: IF must be followed by EXISTS
const query = `drop table if users;` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1702, "Expected `exists` after `IF` in DROP TABLE">>())
