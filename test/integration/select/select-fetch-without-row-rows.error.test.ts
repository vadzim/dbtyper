// Integration Test: SELECT - FETCH without ROW/ROWS keyword
// Integration Test: SELECT syntax validation
// Tests that FETCH clause requires ROW or ROWS keyword

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ❌ ERROR: missing ROW/ROWS keyword in FETCH
const query = `select users.id from users fetch first 5 only;` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table users (id text, name text);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<5301, "Expected ROW or ROWS in FETCH">>
>
