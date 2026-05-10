// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Extends } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id integer, name text);`)
	.database()

// ❌ ERROR: Unknown function
const query = `select unknown_func(name) from t;` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, `create schema public; create table t (id integer, name text);`>[0]

type _errorCheck = Expect<
	Extends<ExtractQueryError<DbShape, typeof query>, DbtyperError<3619, "Unknown function: unknown_func">>
>
