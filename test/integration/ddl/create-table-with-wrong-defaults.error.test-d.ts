// Integration Test: CORE-16 CREATE TABLE with a DEFAULT that does not fit its column
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

// ❌ ERROR: CREATE TABLE with wrong DEFAULT values should throw an error
const query = `create table users (
		id text not null,
		name text not null,
		email text,
		age numeric default 'xxx',
		active boolean default true,
		created_at timestamp default now()
	);` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(
	toBe<DbtyperError<2507, "Incompatible value type for column age">>(),
)
