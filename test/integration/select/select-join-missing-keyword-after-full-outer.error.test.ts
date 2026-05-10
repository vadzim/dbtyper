// Integration Test: JOIN syntax error - missing JOIN after FULL OUTER

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
	.apply(`create table posts (id text, user_id text, title text);`)
	.database()

// ❌ ERROR: missing JOIN after FULL OUTER
const query = `select * from users full outer posts on users.id = posts.user_id;` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table users (id text, name text); create table posts (id text, user_id text, title text);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<4200, "Expected JOIN after FULL OUTER">>
>
