import assert from "node:assert/strict"
import { test } from "node:test"

import { compileExampleDb } from "../src/example-schema.ts"
import type { PostgresTypeMap } from "typesql/postgres"

test("compileExampleDb(..) resolves and exposes database()", async () => {
	const db = await compileExampleDb({
		query: async () => [],
		async *stream() {},
		scalarTypes: {} as PostgresTypeMap,
	})
	assert.equal(typeof db.query, "function")
})
