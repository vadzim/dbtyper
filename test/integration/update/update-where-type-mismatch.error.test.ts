// Integration Test: UPDATE
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text not null, name text not null);`)
	.database()

// ❌ ERROR: Type mismatch in UPDATE WHERE
const query = `update users set name = 'x' where id = 1;` as const

await db.query(query)

type DbShape = ApplyStatements<SqlDatabase, `create schema public; create table users (id text not null, name text not null);`>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<2500, "[dbt:INCOMPATIBLE_TYPES_IN_COMPARISON] Incompatible types in comparison">>
>
