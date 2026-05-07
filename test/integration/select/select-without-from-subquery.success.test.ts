import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

it("should support SELECT with subquery", async () => {
	const db = sqlMigrations({ driver: mockDriver }).database()

	const result = await db.query(`select (select 1) as nested;`)

	type Expected = {
		nested: number
	}[]

	type _check = Expect<Matches<typeof result, Expected>>
})
