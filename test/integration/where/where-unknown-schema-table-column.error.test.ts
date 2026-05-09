// Integration Test: WHERE - Unknown column in schema.table.column reference
import type { DbtyperError } from "../../../src/sql-parser-error.ts"
import type { ExtractQueryError } from "../../../src/core/sql-query.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = mockDriver.database()
	.schema("public", s => s
		.table("users", t => t
			.column("id", c => c.text())
			.column("name", c => c.text())))

const query = `SELECT * FROM users WHERE public.users.nope = 'u'` as const

// @ts-expect-error
db.query(query)

type _errorCheck = Expect<Matches<
	ExtractQueryError<typeof db, typeof query>,
	DbtyperError<-1, string>
>>
