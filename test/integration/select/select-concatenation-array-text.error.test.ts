// Integration Test: SELECT || array concatenation with text (error)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { SqlParserError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer, tags integer[]);`)
	.database()

// ❌ array || text → error
const query = `select array[2,3] || '4' as result from users;` as const


// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table users (id integer, tags integer[]);`
>[0]

type _errorCheck = Expect<Matches<
	ExtractQueryError<DbShape, typeof query>,
	SqlParserError<"Cannot concatenate array with text">
>>
