// Integration Test: Positional parameter requires array
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer);`)
	.database()

// ❌ ERROR: Using positional parameter "?" but params will be inferred as Record
const query = `select * from users where id = ?;` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<SqlDatabase, `create schema public; create table users (id text, age integer);`>[0]

type _test = Expect<
	Matches<
		ExtractQueryError<DbShape, typeof query>,
		DbtyperError<2403, "Positional parameter (?) requires array parameters, not named parameters">
	>
>
