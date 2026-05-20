import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

it("should support SELECT with expressions", async () => {
	const _db = sqlMigrations({ driver: mockDriver }).database()

	const _result = await _db.query(`select 1 + 2 as sum, 'hello' || ' world' as greeting;`)

	type Expected = {
		sum: number
		greeting: string
	}[]

	expectType<typeof _result>(toBe<Expected>())
})
