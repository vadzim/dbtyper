// Integration Test: SELECT
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema billing;`)
	.apply(`create table users (id text not null, name text not null);`)
	.apply(`create table billing.subs (id text not null, user_id text not null);`)
	.database()

// ❌ ERROR: Unknown column in JOIN ON right side
const query =
	`select users.id from users join billing.subs as billing_sub on users.id = billing_sub.not_a_column;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2307, "Unknown qualified column billing_sub.not_a_column">>())
