// Integration Test: ALTER TYPE ... ADD VALUE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

// ❌ FAILURE: ALTER type from unknown schema
const query = `alter type ghost.status add value 'new';` as const

// @ts-expect-error - Expected to fail: unknown schema
await migrations.apply(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, `create schema public;`>[0]

type _errorCheck = Expect<
	Matches<
		ExtractQueryError<DbShape, typeof query>,
		DbtyperError<3207, "Type does not exist or is not an enum; use IF EXISTS">
	>
>
