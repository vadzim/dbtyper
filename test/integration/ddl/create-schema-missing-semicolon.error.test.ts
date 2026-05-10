// Integration Test: CREATE SCHEMA - Unexpected token after schema name
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Extends } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const migrations = sqlMigrations({ driver: mockDriver })

// ❌ ERROR: Unexpected token after schema name (expecting semicolon or EOT)
const query = `create schema myschema extra;` as const

// @ts-expect-error
await migrations.apply(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<SqlDatabase, ``>[0]

type _errorCheck = Expect<
	Extends<ExtractQueryError<DbShape, typeof query>, DbtyperError<1105, "Expected semicolon after schema name in CREATE SCHEMA">>
>
