import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

it("should support SELECT with literal values", async () => {
	const db = sqlMigrations({ driver: mockDriver }).database()

	const _result = await db.query(`select 1 as one, 'hello' as greeting;`)

	type Expected = {
		one: number
		greeting: string
	}[]

	type _check = Expect<Matches<typeof result, Expected>>
})
