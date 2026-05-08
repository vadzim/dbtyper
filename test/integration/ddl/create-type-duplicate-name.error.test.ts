// Integration Test: CREATE TYPE ... AS ENUM
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { SqlParserError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const migrations = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type status as enum ('active');`)

// ❌ FAILURE: Duplicate type name
const query = `create type status as enum ('new');` as const

// @ts-expect-error
await migrations.apply(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, `create schema public; create type status as enum ('active');`>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, SqlParserError<"Type already exists; use IF NOT EXISTS">>
>
