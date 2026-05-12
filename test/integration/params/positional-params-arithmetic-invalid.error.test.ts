// Integration Test: Positional Parameters - Arithmetic with invalid types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.database()

// ❌ ERROR: multiplication with number and string should fail
const query = `select ? * ? as result;` as const

// @ts-expect-error
await db.query(query, [5, "hello"])

type DbShape = ApplyStatements<SqlDatabase, `create schema public;`>[0]

type _test = Expect<
	Matches<
		ExtractQueryError<DbShape, typeof query, [number, string]>,
		DbtyperError<1301, "Incompatible types in arithmetic operation">
	>
>
