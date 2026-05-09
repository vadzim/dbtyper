// Integration Test: SELECT - ANY with non-array column
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id integer, priority integer);`)
	.database()

// ❌ ERROR: ANY requires array type, but priority is integer
const query = `select * from items where id = any(priority);` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table items (id integer, priority integer);`
>[0]

type _errorCheck = Expect<
	Matches<
		ExtractQueryError<DbShape, typeof query>,
		DbtyperError<3001, "[dbt:ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY] ANY/ALL/SOME requires an array or subquery">
	>
>
