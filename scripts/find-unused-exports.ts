// Fails (exit 1) when an export of src/ or scripts/ is used by no other module of src/, scripts/ or test/.
// Entry points of the package (index.ts files) are not reported. Exports that are already unused are
// listed in scripts/unused-exports-baseline.json: that list may only shrink, and a stale entry fails
// the run (delete an entry when you delete or use the export). Run: npm run find-unused
import { readFileSync } from "node:fs"
import { relative } from "node:path"
import { analyzeTsConfig } from "ts-unused-exports"

const ENTRY_POINTS = new Set(["src/index.ts", "src/postgres/index.ts", "src/sqlite/index.ts"])
const baseline: Record<string, string[]> = JSON.parse(
	readFileSync(new URL("./unused-exports-baseline.json", import.meta.url), "utf-8"),
)

const analysis = analyzeTsConfig("tsconfig.unused.json")
const unused = new Map<string, string[]>()
for (const [fullPath, exports] of Object.entries(analysis.unusedExports)) {
	const file = relative(process.cwd(), fullPath)
	if (ENTRY_POINTS.has(file) || file.startsWith("test/")) continue
	unused.set(
		file,
		exports.map(e => e.exportName),
	)
}

let failed = false
for (const [file, names] of unused) {
	const known = new Set(baseline[file] ?? [])
	const fresh = names.filter(n => !known.has(n))
	if (fresh.length > 0) {
		failed = true
		console.error(`${file}: unused export(s) ${fresh.join(", ")} (delete, un-export, or use them)`)
	}
}
for (const [file, names] of Object.entries(baseline)) {
	const still = new Set(unused.get(file) ?? [])
	const stale = names.filter(n => !still.has(n))
	if (stale.length > 0) {
		failed = true
		console.error(`${file}: no longer unused, remove from the baseline: ${stale.join(", ")}`)
	}
}
if (failed) process.exit(1)
console.log("find-unused: ok")
