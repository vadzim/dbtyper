// Integration Test: INSERT with defaults - still must provide NOT NULL columns without DEFAULT
// Integration Test: INSERT with DEFAULT columns
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

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

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table users (
				id text not null,
				name text not null,
				age numeric not null default 18,
				active boolean not null default true,
				created_at timestamp default now()
			);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<3300, "Missing NOT NULL column id in INSERT">>
>
