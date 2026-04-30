import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const tsgoBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsgo.cmd" : "tsgo")

/**
 * When inferred types collapse to wide index signatures, TS often prints fragments
 * like `[k: string]: …` / `: string]` in diagnostics. We want errors from
 * `test/fail-to-compile.ts` to stay readable (narrow shapes), not that noise.
 */
describe("tsgo on tsconfig.test-failing.json", () => {
	it("stderr+stdout do not contain `: string]`", t => {
		const r = spawnSync(tsgoBin, ["--noEmit", "-p", "tsconfig.test-failing.json"], {
			cwd: repoRoot,
			encoding: "utf8",
			maxBuffer: 10 * 1024 * 1024,
		})
		const combined = `${r.stdout ?? ""}${r.stderr ?? ""}`
		if (r.error) {
			if ("code" in r.error && r.error.code === "EPERM") {
				t.skip("spawnSync is blocked in this environment")
				return
			}
			throw r.error
		}
		if (r.status === 0) {
			throw new Error(
				"Expected tsgo to report errors for test/fail-to-compile.ts (non-zero exit). Got status 0.\n" +
					combined.slice(0, 2000),
			)
		}
		if (combined.includes(": string]")) {
			throw new Error(
				`tsgo output contained \`: string]\` (index-signature-style diagnostic). Snippet:\n${combined.slice(0, 8000)}`,
			)
		}
	})
})
