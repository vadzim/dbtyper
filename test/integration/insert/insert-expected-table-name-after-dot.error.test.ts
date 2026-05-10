// Integration Test: INSERT - Expected table name after dot (1221)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table items (id text not null);`)
	.database()

// ❌ ERROR: Expected table name after dot in INSERT INTO
const query = `insert into public. (id) values ('1');` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create table items (id text not null);`
>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<1120, "Expected table name after `.` in INSERT INTO">>
>
