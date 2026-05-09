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
	.apply(`create table inner_t (a int not null);`)
	.database()

// ❌ ERROR: NULL in BETWEEN bounds
const query = `select inner_t.a from inner_t where inner_t.a between null and 1;` as const

// @ts-expect-error
await db.query(query)

type DbShape = ApplyStatements<SqlDatabase, `create schema public; create table inner_t (a int not null);`>[0]

type _errorCheck = Expect<
	Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<2702, "NULL not allowed in BETWEEN">>
>
