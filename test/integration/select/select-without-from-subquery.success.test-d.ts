import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

it("should support SELECT with subquery", async () => {
	const _db = sqlMigrations({ driver: mockDriver }).database()

	const _result = await _db.query(`select (select 1) as nested;`)

	type Expected = {
		nested: number | null
	}[]

	expectType<typeof _result>(toBe<Expected>())
})
