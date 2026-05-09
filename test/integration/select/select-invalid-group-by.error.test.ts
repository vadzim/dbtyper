// Integration Test: SELECT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table posts (id text, user_id text, title text);`)
	.database()

// ❌ ERROR: SELECT non-grouped column without aggregate
const query = `select user_id, title from posts group by user_id;` as const

await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table posts (id text, user_id text, title text);`
>[0]

type _errorCheck = Expect<
	Matches<
		ExtractQueryError<DbShape, typeof query>,
		DbtyperError<3403, "Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">
	>
>
