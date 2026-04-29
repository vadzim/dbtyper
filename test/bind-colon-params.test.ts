import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { bindColonNamedParamsForPg } from "../src/postgres/bind-colon-named-params-for-pg.ts"

describe("bindColonNamedParamsForPg", () => {
	it("maps :name to $n and skips :: casts", () => {
		const { text, values } = bindColonNamedParamsForPg("select x::text where col ~ :pat and y::int = :n", {
			pat: "a",
			n: 1,
		})
		assert.equal(text, "select x::text where col ~ $1 and y::int = $2")
		assert.deepEqual(values, ["a", 1])
	})

	it("reuses one placeholder per repeated name", () => {
		const { text, values } = bindColonNamedParamsForPg("where a = :x and b = :x", { x: 7 })
		assert.equal(text, "where a = $1 and b = $1")
		assert.deepEqual(values, [7])
	})

	it("does not treat : inside single-quoted literals as parameters", () => {
		const { text, values } = bindColonNamedParamsForPg("select ':not_a_param', col = :real where ok", { real: 2 })
		assert.equal(text, "select ':not_a_param', col = $1 where ok")
		assert.deepEqual(values, [2])
	})

	it("handles doubled quotes inside strings", () => {
		const { text, values } = bindColonNamedParamsForPg("select 'it''s :fake', :p", { p: "x" })
		assert.equal(text, "select 'it''s :fake', $1")
		assert.deepEqual(values, ["x"])
	})

	it("throws when a bound name is missing", () => {
		assert.throws(() => bindColonNamedParamsForPg("where x = :missing", {}), /Missing SQL parameter :missing/)
	})
})
