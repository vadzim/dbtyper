// Integration Test: SELECT with type casts - Cannot cast integer to boolean
// Integration Test: PostgreSQL type casts (::type)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table data (id integer not null, value text not null, num integer not null);`)
	.database()

// ❌ ERROR: Cannot cast integer to boolean
// TODO: Currently accepts integer::boolean (no TypeScript type validation in parsers)
const query = `select id::boolean from data;` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table data (id integer not null, value text not null, num integer not null);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<4504, "Cannot cast integer to boolean">>
>
