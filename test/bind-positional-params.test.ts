import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { bindPositionalParamsForPg } from "../src/postgres/bind-positional-params-for-pg.ts"

describe("bindPositionalParamsForPg", () => {
	it("maps ? to $n in order", () => {
		const { text, values } = bindPositionalParamsForPg("select * where col = ? and other = ?", ["a", 1])
		assert.equal(text, "select * where col = $1 and other = $2")
		assert.deepEqual(values, ["a", 1])
	})

	it("handles single positional parameter", () => {
		const { text, values } = bindPositionalParamsForPg("where a = ?", [7])
		assert.equal(text, "where a = $1")
		assert.deepEqual(values, [7])
	})

	it("does not treat ? inside single-quoted literals as parameters", () => {
		const { text, values } = bindPositionalParamsForPg("select '?not_a_param', col = ? where ok", [2])
		assert.equal(text, "select '?not_a_param', col = $1 where ok")
		assert.deepEqual(values, [2])
	})

	it("handles doubled quotes inside strings", () => {
		const { text, values } = bindPositionalParamsForPg("select 'it''s ? fake', ?", ["x"])
		assert.equal(text, "select 'it''s ? fake', $1")
		assert.deepEqual(values, ["x"])
	})

	it("throws when not enough parameters provided", () => {
		assert.throws(
			() => bindPositionalParamsForPg("where x = ? and y = ?", [1]),
			/Not enough parameters: expected at least 2, got 1/,
		)
	})

	it("handles empty parameter array", () => {
		const { text, values } = bindPositionalParamsForPg("select * from users", [])
		assert.equal(text, "select * from users")
		assert.deepEqual(values, [])
	})

	it("handles multiple parameters with various types", () => {
		const { text, values } = bindPositionalParamsForPg("insert into users (name, age, active) values (?, ?, ?)", [
			"Alice",
			30,
			true,
		])
		assert.equal(text, "insert into users (name, age, active) values ($1, $2, $3)")
		assert.deepEqual(values, ["Alice", 30, true])
	})
})
