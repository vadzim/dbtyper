// Integration Test: DEFAULT value type mismatch - UUID function requires uuid column (5204)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ❌ ERROR: DEFAULT value type mismatch - UUID function requires uuid column
const query = `create table items (id text default gen_random_uuid());` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<SqlDatabase, `create schema public;`>[0]

type _errorCheck = Expect<
	Matches<
		ExtractQueryError<DbShape, typeof query>,
		DbtyperError<5204, "DEFAULT value type mismatch: UUID function requires uuid column">
	>
>
