import { describe, it } from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

// EREG-2: an error code belongs to exactly one registry entry. src/dbtyper-error.ts throws at load on a duplicate,
// but every import of it is `import type` (erased), so no other test ever loads it: these tests do.
describe("Error codes are unique (EREG-2)", () => {
	it("the registry module loads (it throws on a duplicate code)", async () => {
		await import("../../src/dbtyper-error.ts")
	})

	it("no two registry entries share a code", async () => {
		const text = await readFile(join(process.cwd(), "src", "dbtyper-error.ts"), "utf-8")
		const byCode = new Map<string, string[]>()
		for (const m of text.matchAll(/^\t(\w+): \{\s*code: (\d+),/gm))
			byCode.set(m[2]!, [...(byCode.get(m[2]!) ?? []), m[1]!])
		const dups = [...byCode].filter(([, ids]) => ids.length > 1).map(([code, ids]) => `${code}: ${ids.join(", ")}`)
		assert.deepStrictEqual(
			dups,
			[],
			"duplicate error codes; pick a never-used number (docs/ERROR_CODES.md, git log -S)",
		)
	})
})
