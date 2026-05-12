// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Extends } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema auth;`)
	.apply(`create table auth.users (id uuid not null, email text not null, display_name text, login_count integer);`)
	.database()

// ❌ ERROR: UUID literal without cast
// Note: PostgreSQL actually allows implicit text-to-UUID conversion in INSERT
// This test may need to be reconsidered or the validation needs to be implemented
const query =
	`insert into auth.users (id, email, display_name, login_count) values ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice', 0);` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create schema auth; create table auth.users (id uuid not null, email text not null, display_name text, login_count integer);`
>[0]

type _errorCheck = Expect<Extends<ExtractQueryError<DbShape, typeof query>, DbtyperError<2507, string>>>
