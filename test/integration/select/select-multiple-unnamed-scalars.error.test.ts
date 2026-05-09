// Integration Test: SELECT - multiple unnamed scalar expressions
// Integration Test: SELECT syntax validation
// Tests that multiple scalar expressions require AS aliases

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

// ❌ ERROR: scalar expressions need AS alias
const query = `select 1, 2 from users;` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, `create schema public; create table users (id text, name text);`>[0]

type _errorCheck = Expect<
	Matches<
		ExtractQueryError<DbShape, typeof query>,
		DbtyperError<3402, "Scalar expression in SELECT requires AS alias">
	>
>
