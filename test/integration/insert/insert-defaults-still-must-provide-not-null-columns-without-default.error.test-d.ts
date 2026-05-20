// Integration Test: INSERT with defaults - still must provide NOT NULL columns without DEFAULT
// Integration Test: INSERT with DEFAULT columns
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
				age numeric not null default 18,
				active boolean not null default true,
				created_at timestamp default now()
			);`,
	)
	.database()

// ❌ ERROR: still must provide NOT NULL columns without DEFAULT
const query = `insert into users (age) values (20) returning *;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<
		| DbtyperError<3300, "Missing NOT NULL column id in INSERT">
		| DbtyperError<3300, "Missing NOT NULL column name in INSERT">
	>(),
)
