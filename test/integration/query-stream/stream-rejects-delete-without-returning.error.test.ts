// Integration Test: _db․stream() rejects non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractResultError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ DELETE without RETURNING should be rejected by stream()
const query = `delete from users where id = '1';` as const

// @ts-expect-error
await db.stream(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, `create schema public; create table users (id text, name text);`>[0]

// type e1 = SqlSelectRow<DbShape, typeof query>
// type e2 = ExtractQueryError<DbShape, typeof query>

type _errorCheck = Expect<
	Matches<
		ExtractResultError<DbShape, typeof query>,
		DbtyperError<3501, "stream() requires a row-returning statement (SELECT or RETURNING clause)">
	>
>
