import assert from "node:assert/strict"
import { test } from "node:test"

import { exampleDb } from "../src/example-schema.ts"
import type { PostgresTypeMap } from "dbtyper/postgres"

test("exampleDb(..) resolves and exposes database()", async () => {
	const db = await exampleDb({
		query: async () => [],
		async *stream() {},
		scalarTypes: {} as PostgresTypeMap,
	})
	assert.equal(typeof db.query, "function")
})
