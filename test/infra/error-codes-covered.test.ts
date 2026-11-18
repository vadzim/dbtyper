import { describe, it } from "node:test"
import assert from "node:assert"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { UNTESTED_ERROR_CODES } from "./untested-error-codes.ts"

// Every active error code must appear in at least one test that CI runs: a file under test/
// that is not skipped (`*.skip.ts`) and not this infra folder. The code is matched as a whole number.
// Codes that have no such test yet are listed in untested-error-codes.ts. That list may only shrink:
// a listed code that is tested now fails here, so remove it from the list.
// 9999 (INTERNAL_ERROR) is excluded: it must never be reachable.
// The registry is read as text (its `errors` object is not exported; the module checks for duplicate codes itself).

async function readActiveErrors() {
	const text = await readFile(join(process.cwd(), "src", "dbtyper-error.ts"), "utf-8")
	const found = new Map<number, string>()
	for (const m of text.matchAll(/^\t(\w+): \{\s*code: (\d+),/gm)) {
		const [, id, code] = m
		if (!id!.startsWith("OBSOLETE_") && code !== "9999" && !found.has(Number(code))) found.set(Number(code), id!)
	}
	return [...found].map(([code, id]) => ({ code, id }))
}

const testDir = join(process.cwd(), "test")

async function readCiTestSources() {
	const entries = await readdir(testDir, { recursive: true, withFileTypes: true })
	const files = entries
		.filter(e => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".skip.ts"))
		.map(e => join(e.parentPath, e.name))
		.filter(p => !p.startsWith(join(testDir, "infra") + "/") && !p.startsWith(testDir + "/."))
	return (await Promise.all(files.map(f => readFile(f, "utf-8")))).join("\n")
}

describe("Error codes are covered by tests", async () => {
	const sources = await readCiTestSources()
	const untested = new Set<number>(UNTESTED_ERROR_CODES)
	const activeCodes = await readActiveErrors()

	for (const { id, code } of activeCodes) {
		const isTested = new RegExp(`\\b${code}\\b`).test(sources)
		it(`${code} ${id}`, () => {
			if (isTested) {
				assert.ok(!untested.has(code), `${code} ${id} is tested now: remove it from UNTESTED_ERROR_CODES`)
			} else {
				assert.ok(
					untested.has(code),
					`${code} ${id} appears in no running test: add a test (do not extend the allow-list)`,
				)
			}
		})
	}

	it("the allow-list names only active error codes", () => {
		const active = new Set(activeCodes.map(c => c.code))
		const unknown = [...untested].filter(c => !active.has(c))
		assert.deepStrictEqual(unknown, [])
	})
})
