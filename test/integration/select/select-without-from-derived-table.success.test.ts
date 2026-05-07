import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

it("should support SELECT without FROM in derived table", async () => {
	const db = sqlMigrations({ driver: mockDriver }).database()

	const result = await db.query(`select * from (select 1 as x, 2 as y) as t;`)

	type Expected = {
		x: number
		y: number
	}[]

	type _check = Expect<Matches<typeof result, Expected>>
})
