// RUN-23: rows hold the values the result row type promises (bigint, number, string), no real DB needed.
import assert from "node:assert/strict"
import { test } from "node:test"
import type postgres from "postgres"

import { postgresSqlDriver } from "../../src/postgres/postgres-sql-driver.ts"

test("RUN-23: postgresSqlDriver installs parsers for int8, numeric and date", () => {
	const parsers: Record<number, (value: string) => unknown> = {
		20: (v) => v,
		1700: (v) => v,
		1082: (v) => new Date(v),
	}
	const sql = { options: { parsers }, unsafe: async () => [] } as unknown as ReturnType<typeof postgres>
	postgresSqlDriver({ sql })
	assert.strictEqual(parsers[20]?.("9007199254740993"), 9007199254740993n)
	assert.strictEqual(parsers[1700]?.("12.5"), 12.5)
	assert.strictEqual(parsers[1082]?.("2024-01-02"), "2024-01-02")
})
