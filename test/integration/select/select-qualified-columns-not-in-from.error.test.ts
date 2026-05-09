// Integration Test: SELECT - qualified columns not in FROM
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
	.apply(`create table other_table (value text);`)
	.database()

// Even though users table exists in database, we cannot reference users.id
// because users is not in the FROM clause (only other_table is)
const query = `select users.id, users.name from other_table;` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table users (id text, name text); create table other_table (value text);`
>[0]

type _errorCheck = Expect<Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<2307, "Unknown qualified column users.id">>>
