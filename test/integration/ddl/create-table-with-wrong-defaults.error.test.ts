// Integration Test: CREATE TABLE with DEFAULT values
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { SqlParserError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`)

// ❌ ERROR: CREATE TABLE with wrong DEFAULT values should throw an error
const query = `create table users (
			id text not null,
			name text not null,
			email text,
			age numeric default 'xxx',
			active boolean default true,
			created_at timestamp default now()
		);` as const

// @ts-expect-error
await migrations.apply(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public;`
>[0]

type _errorCheck = Expect<Matches<
	ExtractQueryError<DbShape, typeof query>,
	SqlParserError<"DEFAULT value type mismatch: expected text/uuid column for string literal">
>>
