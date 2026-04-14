import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getConsumingViolations } from "../borrow-checker.ts"
import { readTypes } from "../read-types.ts"

/** Minimal conditional + @consume overlap (only B-style case). */
const borrowCheckerMinimalSource = `
type X</*@consume*/T> = 1
type A<T> = T extends infer P ? 1 extends T ? [1, X<P>] : [2, T] : never
type B<T> = A<T> extends [infer T1, infer T2] ? [T1, T2] : [0, T]
`

/** Same shape as test-data/1/fail1.ts (B, C, D each violate @consume). */
const borrowCheckerFail1ShapeSource = `
type X</*@consume*/ T> = [1, T]
type A<T> = T extends infer P ? (1 extends T ? [1, X<P>] : [2, T]) : never
type B<TT> = A<TT> extends [infer T1, infer T2] ? [T1, T2] : [0, TT]
type C<TT> = TT extends [infer T1, infer T2] ? [A<T1>, TT] : []
type D<TT> = TT extends [infer T1, infer T2] ? [A<T1>, T2] : []
`

/** `X` in one synthetic file, `A`/`B` in another (like test-data/2). */
const crossFileFail1 = `export type X</*@consume*/ T> = [1, T]
`
const crossFileFail2 = `import type { X } from "./fail1.ts"

export type A<T> = T extends infer P ? (1 extends T ? [1, X<P>] : [2, T]) : never
export type B<TT> = A<TT> extends [infer T1, infer T2] ? [T1, T2] : [0, TT]
`

describe("getConsumingViolations", () => {
	it("flags alias overlap for @consume in the commented conditional example", () => {
		const result = readTypes("./x.ts", borrowCheckerMinimalSource)
		const typesById = new Map(result.types.map(t => [t.id, t]))
		const violations = [...getConsumingViolations(result)]

		assert.equal(violations.length, 1)
		const v = violations[0]
		assert.ok(v)
		assert.equal(typesById.get(v.errorneousUsage.typeId)?.sourceKind, "typeParam")
		assert.equal(typesById.get(v.borrower.typeId)?.name, "A")
		assert.equal(v.borrower.argumentIndex, 0)
		assert.ok(v.commonIds.length > 0)
		assert.ok(typesById.get(v.borrowedValue.typeId))
	})

	it("flags B, C, and D when infer splits TT and T1 is consumed by A before another use", () => {
		const result = readTypes("./fail1.ts", borrowCheckerFail1ShapeSource)
		const typesById = new Map(result.types.map(t => [t.id, t]))
		const violations = [...getConsumingViolations(result)]

		assert.equal(violations.length, 3)

		const cStyle = violations.filter(
			v =>
				typesById.get(v.borrower.typeId)?.name === "A" &&
				typesById.get(v.borrowedValue.typeId)?.name === "T1" &&
				typesById.get(v.errorneousUsage.typeId)?.name === "TT",
		)
		assert.equal(
			cStyle.length,
			1,
			"expected exactly one violation for C: A consumes T1 (inferred from TT) then TT is reused",
		)
	})

	it("flags B when X is imported from another file (refScopes on typeImport)", () => {
		const base = "./src/type-checker/test-data/2/"
		const part0 = readTypes(`${base}fail1.ts`, crossFileFail1, { idPrefix: "f0:" })
		const part1 = readTypes(`${base}fail2.ts`, crossFileFail2, { idPrefix: "f1:" })
		const merged = { types: [...part0.types, ...part1.types], scopes: [...part0.scopes, ...part1.scopes] }
		const typesById = new Map(merged.types.map(t => [t.id, t]))
		const violations = [...getConsumingViolations(merged)]

		assert.equal(violations.length, 1)
		const v = violations[0]
		assert.ok(v)
		assert.equal(typesById.get(v.borrower.typeId)?.name, "A")
	})
})
