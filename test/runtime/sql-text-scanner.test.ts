import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { POSTGRES_SCAN_RULES, SQLITE_SCAN_RULES, skipNonCode } from "../../src/core/sql-text-scanner.ts"
import { bindColonNamedParamsForPg } from "../../src/postgres/bind-colon-named-params-for-pg.ts"

/** Every index of `sql` that is code (not inside a string, quoted name, comment or dollar body). */
function codeIndexes(sql: string, rules: typeof POSTGRES_SCAN_RULES): number[] {
	const out: number[] = []
	let i = 0
	while (i < sql.length) {
		const end = skipNonCode(sql, i, rules)
		if (end > i) i = end
		else out.push(i++)
	}
	return out
}

describe("shared SQL text scanner (PARAM-15, #146 batch 4; lexer rules at run time)", () => {
	it("PARAM-15: :name is left alone in comments, quoted identifiers and dollar bodies", () => {
		const sql = `select "a:b", 'c:d' /* :x */ -- :x\n, $$ :x $$, $t$ :x $$ :x $t$, :real from t`
		const r = bindColonNamedParamsForPg(sql, { real: 7 })
		assert.equal(r.text, sql.replace(":real", "$1"))
		assert.deepEqual(r.values, [7])
	})
	it("PARAM-15: a name inside hidden text does not throw, a missing real one does", () => {
		assert.doesNotThrow(() => bindColonNamedParamsForPg(`select 1 -- :missing`, {}))
		assert.throws(() => bindColonNamedParamsForPg(`select :missing`, {}), /Missing SQL parameter :missing/)
	})
	it("a dollar tag longer than 62 characters still opens a body (no length window)", () => {
		const tag = `$${"a".repeat(100)}$`
		const sql = `select ${tag} ? :x ${tag}, ?`
		const code = codeIndexes(sql, POSTGRES_SCAN_RULES)
		assert.equal(code.includes(sql.lastIndexOf("?")), true)
		assert.equal(code.includes(sql.indexOf("?")), false)
	})
	it("PostgreSQL block comments nest, SQLite ones end at the first close", () => {
		const sql = "/* a /* b */ ? */ ?"
		assert.equal(codeIndexes(sql, POSTGRES_SCAN_RULES).includes(sql.indexOf("?")), false)
		assert.equal(codeIndexes(sql, SQLITE_SCAN_RULES).includes(sql.indexOf("?")), true)
	})
	it("only SQLite has backtick and bracket names; only PostgreSQL has dollar bodies", () => {
		assert.equal(skipNonCode("`a?`", 0, SQLITE_SCAN_RULES), 4)
		assert.equal(skipNonCode("`a?`", 0, POSTGRES_SCAN_RULES), 0)
		assert.equal(skipNonCode("[a?]", 0, SQLITE_SCAN_RULES), 4)
		assert.equal(skipNonCode("$$a$$", 0, POSTGRES_SCAN_RULES), 5)
		assert.equal(skipNonCode("$$a$$", 0, SQLITE_SCAN_RULES), 0)
	})
})
