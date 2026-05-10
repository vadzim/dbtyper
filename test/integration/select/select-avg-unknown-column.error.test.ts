// Integration Test: SELECT - unknown column in AVG
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
	.database()

// ❌ ERROR: Unknown column in AVG
const query = `select avg(ghost_column) from users;` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table users (id integer, name text);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<2300, "Unknown column ghost_column in ">>
>
