// Generates docs/ERROR_CODES.md from the error registry src/dbtyper-error.ts (EREG-1).
// Run: npm run gen-error-codes (writes the file) or node scripts/gen-error-codes.ts --check (exit 1 when stale).
// test/infra/error-codes-doc.test.ts runs the same check in CI.
import { readFileSync, writeFileSync } from "node:fs"
import { format, resolveConfig } from "prettier"

const REGISTRY = new URL("../src/dbtyper-error.ts", import.meta.url)
const DOC = new URL("../docs/ERROR_CODES.md", import.meta.url)

type Entry = { id: string; code: number; msg: string[] }

function readCategories(text: string): { from: number; name: string }[] {
	return [...text.matchAll(/^ \* - (\d{4})-\d{4}: (.+?)(?: Errors)?$/gm)].map(m => ({
		from: Number(m[1]),
		name: m[2]!.replace(/ \(.*$/, ""),
	}))
}

function readEntries(text: string): Entry[] {
	const body = text.slice(text.indexOf("const errors = {"))
	const re = /^\t(\w+): \{\s*code: (\d+),\s*msg: (\[[\s\S]*?\]),?\s*\},?$/gm
	// The registry is this repo's own source text: its `msg` arrays are plain string literals.
	return [...body.matchAll(re)].map(m => ({
		id: m[1]!,
		code: Number(m[2]),
		msg: new Function(`return ${m[3]}`)() as string[],
	}))
}

function cell(s: string): string {
	return s.replace(/[\\|<>*_`[\]]/g, c => `\\${c}`)
}

function message(parts: string[]): string {
	return parts.map(cell).join("…")
}

async function generateErrorCodes(registryText: string): Promise<string> {
	const categories = readCategories(registryText)
	const entries = readEntries(registryText).sort((a, b) => a.code - b.code)
	const active = entries.filter(e => !e.id.startsWith("OBSOLETE_") && e.code !== 9999)
	const obsolete = entries.filter(e => e.id.startsWith("OBSOLETE_"))
	const internal = entries.filter(e => e.code === 9999)
	const out: string[] = [
		"# Error code reference",
		"",
		"<!-- Generated from src/dbtyper-error.ts by scripts/gen-error-codes.ts (npm run gen-error-codes). Do not edit by hand. -->",
		"",
		`dbtyper has **${active.length} active error codes** and ${obsolete.length} retired ones. A compile error is the TypeScript type \`DbtyperError<Code, Message>\`; the code is the number in \`__sql_parser_error_code__\`, the text is in \`__sql_parser_error__\`. A \`…\` in a message marks a place where dbtyper inserts a name or a value (a table, a column, a type).`,
		"",
		"A code is never reused. A removed error stays in the registry as `OBSOLETE_<code>_<name>` (see the end of this page), because codes are used in online help.",
		"",
		"## Ranges",
		"",
		"| Range | Category | Active codes |",
		"| ----- | -------- | -----------: |",
	]
	const bucket = (code: number) => Math.floor(code / 100) * 100
	const nameOf = (from: number) => categories.find(c => c.from === from)?.name ?? "Other"
	const starts = [...new Set(active.map(e => bucket(e.code)))].sort((a, b) => a - b)
	for (const s of starts) {
		const n = active.filter(e => bucket(e.code) === s).length
		out.push(`| ${s}-${s + 99} | ${nameOf(s)} | ${n} |`)
	}
	for (const s of starts) {
		out.push("", `## ${s}-${s + 99}: ${nameOf(s)}`, "", "| Code | Name | Message |", "| ---- | ---- | ------- |")
		for (const e of active.filter(x => bucket(x.code) === s))
			out.push(`| ${e.code} | \`${e.id}\` | ${message(e.msg)} |`)
	}
	if (internal.length > 0) {
		out.push("", "## Internal error", "")
		for (const e of internal)
			out.push(`- ${e.code} \`${e.id}\`: it must never be reachable; if you see it, report a bug.`)
	}
	out.push("", "## Retired codes", "", "| Code | Former name |", "| ---- | ----------- |")
	for (const e of obsolete) out.push(`| ${e.code} | \`${e.id.replace(/^OBSOLETE_\d+_?/, "") || e.id}\` |`)
	out.push("")
	const file = new URL(import.meta.url).pathname
	return format(out.join("\n"), { ...(await resolveConfig(file)), parser: "markdown" })
}

export async function errorCodesDocIsCurrent(): Promise<boolean> {
	return readFileSync(DOC, "utf-8") === (await generateErrorCodes(readFileSync(REGISTRY, "utf-8")))
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
	const generated = await generateErrorCodes(readFileSync(REGISTRY, "utf-8"))
	if (process.argv.includes("--check")) {
		if (readFileSync(DOC, "utf-8") !== generated) {
			console.error("docs/ERROR_CODES.md is out of date: run `npm run gen-error-codes`")
			process.exit(1)
		}
	} else writeFileSync(DOC, generated)
}
