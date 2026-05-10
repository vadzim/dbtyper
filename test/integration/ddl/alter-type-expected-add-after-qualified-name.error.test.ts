// Integration Test: ALTER TYPE - Expected ADD in ALTER TYPE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Extends } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const migrations = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create type public.status as enum ('active');`)

// ❌ ERROR: Expected ADD in ALTER TYPE (qualified name followed by non-add token)
const query = `alter type public.status value 'inactive';` as const

// @ts-expect-error
await migrations.apply(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, `create schema public; create type public.status as enum ('active');`>[0]

type _errorCheck = Expect<
	Extends<ExtractQueryError<DbShape, typeof query>, DbtyperError<1813, "Expected `add` in ALTER TYPE">>
>
