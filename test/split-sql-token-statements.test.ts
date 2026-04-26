import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readNextToken, splitSqls } from "../scripts/split-sql-token-statements.ts"

describe("split-sql-token-statements (runtime lexer)", () => {
	it("groups statements by ;", () => {
		const src = "select 'as$$d'; select 2;"
		const sqls = splitSqls(src)
		assert.deepEqual(sqls, ["select $1$as$$d$1$", "select 2"])
	})

	it("advances past a triple-nested block comment to the next token", () => {
		const s = "/* a /* b /* c */ d */ e */x"
		const { token, end } = readNextToken(s, 0)
		assert.equal(token.kind, "ident")
		assert.equal(token.value, "x")
		assert.equal(end, s.length)
	})
})
