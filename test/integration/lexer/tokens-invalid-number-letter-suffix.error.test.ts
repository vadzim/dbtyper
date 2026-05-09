// Integration Test: Lexer - Invalid number with letter suffix
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ExtractQueryError } from "../../../src/core/sql-query.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = mockDriver.database()
	.schema("public", s => s.table("t", t => t.column("id", c => c.integer())))

const query = `SELECT 123x FROM t` as const

// @ts-expect-error
db.query(query)

type _errorCheck = Expect<Matches<
	ExtractQueryError<typeof db, typeof query>,
	DbtyperError<2116, "Invalid number">
>>
