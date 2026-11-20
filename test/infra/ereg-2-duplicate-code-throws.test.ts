import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

// EREG-2 Check: a registry entry with a code already in use throws when the registry module loads.
// The test loads a copy of src/dbtyper-error.ts with one extra entry that reuses code 1001.
describe("EREG-2 duplicate code throws on load", () => {
	it("EREG-2 a registry with a reused code throws at import", async () => {
		const src = resolve(process.cwd(), "src")
		const text = await readFile(join(src, "dbtyper-error.ts"), "utf-8")
		const marker = "const errors = {\n"
		assert.ok(text.includes(marker))
		const patched = text
			.replace(marker, `${marker}\tEREG_TEST_DUPLICATE: {\n\t\tcode: 1001,\n\t\tmsg: ["duplicate"],\n\t},\n`)
			.replace('"./core/type-utils.ts"', JSON.stringify(pathToFileURL(join(src, "core", "type-utils.ts")).href))
		const dir = await mkdtemp(join(tmpdir(), "ereg2-"))
		try {
			const file = join(dir, "dbtyper-error.ts")
			await writeFile(file, patched)
			await assert.rejects(import(pathToFileURL(file).href), /1001/)
		} finally {
			await rm(dir, { recursive: true })
		}
	})
})
