#!/usr/bin/env node
// CLI: parse repeatable opaque identities + glob sources, then report getOpaqueViolations().
// Example: node src/borrow-checker/check-opaque.ts --opaque "./opaque.ts" "Opaque" --opaque "./id.ts" "UserId" "src/**/*.ts"
import { readFile } from "node:fs/promises"
import path from "node:path"
import fg from "fast-glob"
import { getOpaqueViolations } from "./opaque-type-checker.ts"
import { DEFAULT_SNIPPET_TAB_WIDTH, formatSourceSnippet } from "./format-source-snippet.ts"
import { readTypes, type ReadTypesResult, type TypeEntry } from "./read-types.ts"

function usage(): never {
	console.error(`Usage: node src/borrow-checker/check-opaque.ts [--opaque <opaque-file> <opaque-type-name>]... <glob> [glob...]

  Resolves files with fast-glob, runs readTypes per file, then reports
  getOpaqueViolations() for each provided opaque type identity.
  --opaque can be repeated and may appear before, after, or between globs.
  Exit 1 if any violation, if no opaque type is provided, if globs are
  missing, or if no files match.`)
	process.exit(1)
}

/** Same logical path key as readTypes uses for TypeEntry.file/refFile. */
function normalizeLogicalPath(filePath: string): string {
	const normalized = path.posix.normalize(filePath)
	if (normalized.startsWith("/")) return normalized
	return normalized === "." || normalized.startsWith("./") ? normalized : `./${normalized}`
}

async function readTypesWithSources(paths: readonly string[]): Promise<{
	result: ReadTypesResult
	sourcesByPath: Map<string, string>
}> {
	const combined: ReadTypesResult = { types: [], scopes: [] }
	const sourcesByPath = new Map<string, string>()

	for (const [index, filePath] of paths.entries()) {
		const content = await readFile(filePath, { encoding: "utf8" })
		sourcesByPath.set(normalizeLogicalPath(filePath), content)
		const part = readTypes(filePath, content, { includeAst: true, idPrefix: `f${index}:` })
		combined.types.push(...part.types)
		combined.scopes.push(...part.scopes)
	}

	return { result: combined, sourcesByPath }
}

function indexById<T extends { id: string }>(entries: readonly T[]): Map<string, T> {
	return new Map(entries.map(e => [e.id, e]))
}

function printViolationSnippet(
	sourcesByPath: Map<string, string>,
	types: Map<string, TypeEntry>,
	violation: ReturnType<typeof getOpaqueViolations>[number],
): void {
	const renderedMessage = renderOpaqueMessage(violation.message)
	if (!violation.ref || !violation.file) {
		console.error(`opaque-check: ${renderedMessage.primary}`)
		if (renderedMessage.note) printIndentedStderr(`note: ${renderedMessage.note}`)
		return
	}
	console.error(`${violation.file}:${violation.ref.pos.line}:${violation.ref.pos.column}: ${renderedMessage.primary}`)
	if (renderedMessage.note) {
		printIndentedStderr(`note: ${renderedMessage.note}`)
	}
	console.error()
	printReferenceSnippet(sourcesByPath, types, violation.file, violation.ref)
	if (isDuplicateUsageViolation(violation.message) && violation.relatedFile && violation.relatedRef) {
		printIndentedStderr(
			`${violation.relatedFile}:${violation.relatedRef.pos.line}:${violation.relatedRef.pos.column}: second usage`,
		)
		printIndentedStderr("")
		printReferenceSnippet(sourcesByPath, types, violation.relatedFile, violation.relatedRef, true)
	}
}

const DIAG_INDENT = "    "

function printIndentedStderr(line: string): void {
	console.error(`${DIAG_INDENT}${line}`)
}

function printIndentedStderrBlock(text: string): void {
	for (const line of text.split("\n")) printIndentedStderr(line)
}

function printReferenceSnippet(
	sourcesByPath: Map<string, string>,
	types: Map<string, TypeEntry>,
	file: string,
	ref: NonNullable<ReturnType<typeof getOpaqueViolations>[number]["ref"]>,
	outline = false,
): void {
	const source = sourcesByPath.get(normalizeLogicalPath(file)) ?? sourcesByPath.get(file)
	const type = types.get(ref.typeId)
	const line = outline ? printIndentedStderr : (s: string) => console.error(s)
	const block = outline ? printIndentedStderrBlock : (s: string) => console.error(s)
	if (!source || !type) return
	block(
		formatSourceSnippet(
			source,
			{
				line: ref.pos.line,
				startPos: ref.pos.start,
				textLength: type.name.length > 0 ? type.name.length : 1,
			},
			{ tabWidth: DEFAULT_SNIPPET_TAB_WIDTH },
		),
	)
	line("")
}

function renderOpaqueMessage(message: string): { primary: string; note?: string } {
	const varMatch = message.match(/^Opaque-constrained type variable (\S+) /)
	const variable = varMatch?.[1] ?? "type variable"
	if (message.includes("cannot be used in extends condition")) {
		return {
			primary: `Type "${variable}" cannot be used in a conditional check.`,
			note: "Opaque-constrained values are not allowed in the check side of ternaries.",
		}
	}
	if (message.includes("cannot be used more than once in the same ternary branch")) {
		return {
			primary: `Type "${variable}" is reused in one ternary branch.`,
			note: "Use each opaque-constrained value at most once per branch.",
		}
	}
	if (message.includes("cannot be used more than once in one conditional body")) {
		return {
			primary: `Type "${variable}" is reused in one conditional body.`,
			note: "A conditional body cannot consume the same opaque-constrained value twice.",
		}
	}
	if (message.includes("cannot be used more than once outside ternary body")) {
		return {
			primary: `Type "${variable}" is reused outside ternary branches.`,
			note: "Opaque-constrained values must remain linear in type declarations.",
		}
	}
	if (message.includes("without extends constraint")) {
		const callee = message.match(/generic (\S+) without extends constraint/)?.[1] ?? "generic"
		return {
			primary: `Type "${variable}" cannot be passed to "${callee}".`,
			note: "The callee argument must be constrained by the same opaque type.",
		}
	}
	if (message.includes("that destructures this argument")) {
		const callee = message.match(/generic (\S+) that destructures this argument/)?.[1] ?? "generic"
		return {
			primary: `Type "${variable}" cannot be passed to "${callee}".`,
			note: "The callee destructures this opaque-constrained argument.",
		}
	}
	return { primary: message }
}

function isDuplicateUsageViolation(message: string): boolean {
	return (
		message.includes("cannot be used more than once in the same ternary branch") ||
		message.includes("cannot be used more than once in one conditional body") ||
		message.includes("cannot be used more than once outside ternary body")
	)
}

type OpaqueTypeOption = {
	fileName: string
	typeName: string
}

function parseArgs(argv: readonly string[]): {
	opaqueTypes: OpaqueTypeOption[]
	globs: string[]
} {
	const opaqueTypes: OpaqueTypeOption[] = []
	const globs: string[] = []
	for (let index = 0; index < argv.length; index++) {
		const token = argv[index]
		if (!token) continue
		if (token === "--opaque") {
			const fileName = argv[index + 1]
			const typeName = argv[index + 2]
			if (!fileName || !typeName) usage()
			opaqueTypes.push({ fileName: normalizeLogicalPath(fileName), typeName })
			index += 2
			continue
		}
		if (token.length > 0) globs.push(token)
	}
	return { opaqueTypes, globs }
}

async function main() {
	const { opaqueTypes, globs } = parseArgs(process.argv.slice(2))
	if (opaqueTypes.length === 0) {
		console.error("At least one opaque type must be specified via --opaque <file> <name>.")
		usage()
	}
	if (globs.length === 0) {
		console.error("At least one glob must be specified.")
		usage()
	}

	const paths = await fg(globs, { onlyFiles: true, unique: true })
	if (paths.length === 0) {
		console.error("No files matched the given glob(s).")
		process.exit(1)
	}

	const { result, sourcesByPath } = await readTypesWithSources(paths)
	const types = indexById(result.types)
	const violations = opaqueTypes.flatMap(opaqueType => getOpaqueViolations(result, opaqueType))

	if (violations.length > 0) {
		const filesWithViolations = new Set<string>()
		for (const [index, violation] of violations.entries()) {
			if (index > 0) console.error()
			if (violation.file) filesWithViolations.add(normalizeLogicalPath(violation.file))
			printViolationSnippet(sourcesByPath, types, violation)
		}
		const n = violations.length
		const f = filesWithViolations.size
		const errorLabel = n === 1 ? "error" : "errors"
		const fileLabel = f === 1 ? "file" : "files"
		console.error(`Found ${n} ${errorLabel} in ${f} ${fileLabel}.`)
		process.exit(1)
	}

	const scanned = paths.length
	const scannedLabel = scanned === 1 ? "file" : "files"
	console.log(`No errors found (${scanned} ${scannedLabel} checked).`)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
