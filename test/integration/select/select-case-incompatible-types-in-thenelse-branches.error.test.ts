// Integration Test: SELECT with CASE WHEN (searched form) - Incompatible types in THEN/ELSE branches
// Integration Test: SELECT with CASE WHEN (searched form)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table users (
				id text not null,
				name text not null,
				age integer not null,
				active boolean not null
			);`,
	)
	.database()

// ❌ ERROR: Incompatible types in THEN/ELSE branches
const query = `select case when active then 'text' else 123 end from users;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2502, "Incompatible types in CASE">>())
