// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Extends } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

// ❌ FAILURE: Missing AS keyword
const query = `create type status enum ('active');` as const

await migrations.apply(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, `create schema public;`>[0]

type _errorCheck = Expect<
	Extends<ExtractQueryError<DbShape, typeof query>, DbtyperError<4103, "Expected `.` or keyword after name">>
>
