// Integration Test: DML-4 several missing NOT NULL columns
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null, email text not null);`)
	.database()

// ❌ ERROR: several missing NOT NULL columns
const query = `insert into users (id) values ('3');` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<
		| DbtyperError<3300, "Missing NOT NULL column name in INSERT">
		| DbtyperError<3300, "Missing NOT NULL column email in INSERT">
	>(),
)
