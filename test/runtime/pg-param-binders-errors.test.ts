import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { bindColonNamedParamsForPg } from "../../src/postgres/bind-colon-named-params-for-pg.ts"

describe("pg param binders (fake values, no client)", () => {
	it("PARAM-15: :name becomes $n in order of first appearance, reused names share $n, :: and quotes are left alone", () => {
		const r = bindColonNamedParamsForPg(`select ':x', a::text from t where a = :a or b = :b or c = :a`, {
			a: 1,
			b: 2,
			unused: 3,
		})
		assert.equal(r.text, `select ':x', a::text from t where a = $1 or b = $2 or c = $1`)
		assert.deepEqual(r.values, [1, 2])
	})
	it("PARAM-16: a missing :name throws before anything is sent", () => {
		assert.throws(() => bindColonNamedParamsForPg(`select :a`, {}), /Missing SQL parameter :a/)
	})
})
