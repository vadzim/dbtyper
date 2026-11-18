import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type postgres from "postgres"

import { postgresSqlDriver } from "../../src/postgres/index.ts"

describe("postgresSqlDriver", () => {
	it("PGT-3: never changes the parsers of the user's postgres client", () => {
		const parsers: Record<number, unknown> = {}
		const sql = Object.assign(() => undefined, { options: { parsers } }) as unknown as ReturnType<typeof postgres>
		postgresSqlDriver({ sql })
		postgresSqlDriver({ sql, bigint: true })
		assert.deepEqual(parsers, {})
	})
})
