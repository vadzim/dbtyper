import { it } from "node:test"
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

it("should reject || concatenation of two numbers", () => {
	const _db = sqlMigrations({ driver: mockDriver }).database()

	// PostgreSQL does not support concatenation of two numbers
	const _result = _db.query(
		// @ts-expect-error
		`select 1 || 2 as invalid;`,
	)
})
