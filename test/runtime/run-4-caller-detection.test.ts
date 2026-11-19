// RUN-4: migration() finds its caller's file from the stack: frames with and without parentheses, any extension.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { migrationCallerFile } from "../../src/core/sql-migrations.ts"

const own = "/pkg/dbtyper"
const stack = (...frames: string[]) => ["Error", ...frames].join("\n")

describe("RUN-4 caller detection", () => {
	const cases: Array<[string, string, string]> = [
		["parenthesised .js", "    at generateSql (/app/migrations/001.do.a.js:3:9)", "/app/migrations/001.do.a.js"],
		["no parentheses", "    at /app/migrations/001.do.a.js:3:9", "/app/migrations/001.do.a.js"],
		["file URL .mjs", "    at f (file:///app/m/001.mjs:3:9)", "/app/m/001.mjs"],
		["file URL without parentheses .cjs", "    at file:///app/m/001.cjs:3:9", "/app/m/001.cjs"],
		["tsx .ts", "    at Object.<anonymous> (/app/m/001.ts:3:9)", "/app/m/001.ts"],
		["async frame", "    at async load (/app/m/001.js:3:9)", "/app/m/001.js"],
		["new frame", "    at new Foo (/app/m/001.js:3:9)", "/app/m/001.js"],
	]
	for (const [name, frame, expected] of cases) {
		it(`RUN-4: ${name}`, () => {
			const s = stack(`    at migration (${own}/src/core/sql-migrations.ts:1:1)`, frame)
			assert.equal(migrationCallerFile(s, own), expected)
		})
	}
	it("RUN-4: skips every dbtyper frame and node internals, whatever the call depth", () => {
		const s = stack(
			`    at migrationCallerFile (${own}/dist/core/sql-migrations.js:1:1)`,
			`    at migration (file://${own}/dist/core/sql-migrations.js:1:1)`,
			`    at wrap (${own}/dist/core/other.js:1:1)`,
			"    at node:internal/modules/esm/module_job:1:1",
			"    at /app/m/001.mjs:3:9",
		)
		assert.equal(migrationCallerFile(s, own), "/app/m/001.mjs")
	})
	it("RUN-4: no frame outside dbtyper gives undefined", () => {
		assert.equal(migrationCallerFile(stack(`    at x (${own}/src/a.ts:1:1)`), own), undefined)
	})
})
