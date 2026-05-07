import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

it("should support || concatenation of text and number as string", async () => {
	const _db = sqlMigrations({ driver: mockDriver }).database()

	const _result = await _db.query(`select 1 || '2' as a, '1' || 2 as b;`)

	type Expected = {
		a: string
		b: string
	}[]

	type _check = Expect<Matches<typeof _result, Expected>>
})
