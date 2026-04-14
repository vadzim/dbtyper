import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	compareOpaqueRefSpanOrder,
	occurrenceLabelRelativeToOther,
} from "../opaque-diagnostic-labels.ts"

const pos = (start: number, line: number, column: number, end: number) => ({
	start,
	end,
	line,
	column,
})

describe("opaque duplicate-usage diagnostic labels", () => {
	it("labels the earlier span first usage and the later span second usage (same file)", () => {
		const file = "./usage.ts"
		const earlier = { typeId: "t1", pos: pos(10, 1, 5, 11) }
		const later = { typeId: "t1", pos: pos(40, 2, 1, 41) }
		assert.equal(occurrenceLabelRelativeToOther(file, earlier, file, later), "first usage")
		assert.equal(occurrenceLabelRelativeToOther(file, later, file, earlier), "second usage")
		assert.ok(compareOpaqueRefSpanOrder(file, earlier, file, later) < 0)
		assert.ok(compareOpaqueRefSpanOrder(file, later, file, earlier) > 0)
	})

	it("matches checker convention: primary ref is later, related ref is earlier (labels second / first)", () => {
		const file = "./usage.ts"
		const earlier = { typeId: "t1", pos: pos(10, 1, 5, 11) }
		const later = { typeId: "t1", pos: pos(40, 2, 1, 41) }
		const primaryLabel = occurrenceLabelRelativeToOther(file, later, file, earlier)
		const relatedLabel = occurrenceLabelRelativeToOther(file, earlier, file, later)
		assert.equal(primaryLabel, "second usage")
		assert.equal(relatedLabel, "first usage")
	})

	it("orders by file path when spans are in different files", () => {
		const ref = { typeId: "t1", pos: pos(100, 1, 1, 101) }
		const aFirst = occurrenceLabelRelativeToOther("./a.ts", ref, "./b.ts", ref)
		const bSecond = occurrenceLabelRelativeToOther("./b.ts", ref, "./a.ts", ref)
		assert.equal(aFirst, "first usage")
		assert.equal(bSecond, "second usage")
	})
})
