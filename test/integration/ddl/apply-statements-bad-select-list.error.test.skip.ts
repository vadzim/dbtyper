// Integration Test: ApplyStatements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table ok_sel ( id int );`)
	.database()

// ❌ ERROR: Scalar expression in SELECT requires AS alias
const query = `select 1, 2 from ok_sel;` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<SqlDatabase, `create schema public; create table ok_sel ( id int );`>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<3401, "Scalar expression in SELECT requires AS alias">>
>
