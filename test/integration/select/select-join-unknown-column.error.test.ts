// Integration Test: SELECT - unknown column in JOIN
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer, name text);`)
	.apply(`create table posts (id integer, user_id integer);`)
	.database()

// ❌ ERROR: Unknown column in JOIN ON
const query = `select * from users join posts on users.ghost_column = posts.user_id;` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table users (id integer, name text); create table posts (id integer, user_id integer);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<2307, "Unknown qualified column users.ghost_column">>
>
