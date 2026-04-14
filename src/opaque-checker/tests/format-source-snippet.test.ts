import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_SNIPPET_TAB_WIDTH, formatSourceSnippet } from "../format-source-snippet.ts"

describe("formatSourceSnippet", () => {
	it("aligns markers when the line uses tabs", () => {
		const source = ["line1", "\t\tfooBar", "line3"].join("\n")
		const line2Start = source.indexOf("\t\tfooBar")
		const fooStart = source.indexOf("fooBar")
		const out = formatSourceSnippet(
			source,
			{ line: 2, startPos: fooStart, textLength: 3 },
			{ contextBefore: 0, contextAfter: 0, noColor: true, tabWidth: DEFAULT_SNIPPET_TAB_WIDTH },
		)
		const lines = out.split("\n")
		assert.equal(lines.length, 2)
		assert.equal(lines[0], "2 |         fooBar")
		const afterPipe = lines[1]!.split(" | ")[1]
		assert.equal(afterPipe, "        ~~~")
	})
})
