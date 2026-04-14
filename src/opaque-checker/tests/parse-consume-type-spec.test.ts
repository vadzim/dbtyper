import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseConsumeTypeSpec } from "../opaque-type-checker.ts"

describe("parseConsumeTypeSpec", () => {
	it("parses type name only (all consumer type parameters)", () => {
		assert.deepEqual(parseConsumeTypeSpec("MyConsumer"), { typeName: "MyConsumer" })
	})

	it("parses a single 0-based index", () => {
		assert.deepEqual(parseConsumeTypeSpec("MyConsumer:0"), { typeName: "MyConsumer", typeArgumentIndexes: [0] })
	})

	it("parses multiple colon-separated indexes", () => {
		assert.deepEqual(parseConsumeTypeSpec("MyConsumer:1:2"), { typeName: "MyConsumer", typeArgumentIndexes: [1, 2] })
	})
})
