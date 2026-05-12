import assert from "node:assert/strict"
import { test } from "node:test"

import { exampleDb } from "../src/example-schema.ts"
import type { PostgresDriver } from "dbtyper/postgres"
import { createDriver } from "../../../src/core/sql-database.ts"

test("exampleDb(..) resolves and exposes database()", async () => {
	const db = await exampleDb(createDriver<PostgresDriver>({ query: async () => [] }))
	assert.equal(typeof db.query, "function")
	assert.equal(typeof db.stream, "function")
})
