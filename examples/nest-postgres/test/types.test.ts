import assert from "node:assert/strict"
import { test } from "node:test"

import { compileExampleDb } from "../src/example-schema.ts"

test("compileExampleDb() resolves and exposes connect()", async () => {
	const db = await compileExampleDb()
	assert.equal(typeof db.connect, "function")
})
