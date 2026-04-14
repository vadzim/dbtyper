#!/usr/bin/env node
// CLI: parse repeatable opaque identities + glob sources, then report getOpaqueViolations().
// Example: node src/opaque-checker/check-opaque.ts --opaque "./opaque.ts" "Opaque" --consumer "./dual.ts" "Dual:0" "src/**/*.ts"
import { readFile } from "node:fs/promises"
import fg from "fast-glob"
import { normalizeLogicalPath, OpaqueCliParseError, parseOpaqueCliArgs } from "./opaque-cli-args.ts"
import { getOpaqueViolations } from "./opaque-type-checker.ts"
import { DEFAULT_SNIPPET_TAB_WIDTH, formatDiagnosticHeader, formatSourceSnippet } from "./format-source-snippet.ts"
import { readTypes, type ReadTypesResult, type TypeEntry } from "./read-types.ts"

function usage(): never {
	console.error(`Usage: node src/opaque-checker/check-opaque.ts [options] <glob> [glob...]

  Options:
    --snippet-lines <before>[:<after>]
        Number of lines to render around marker (defaults 4:0).
        <before> counts snippet lines up to marker line (inclusive).
        <after> counts lines after marker line.
        Examples: 7, 7:2, :2.

  Repeatable options:
    --opaque <file> <type-name>
        Branded / leaf opaque identity to enforce.
    --consumer <file> <spec>
        Consumer generic (or leaf) that carries opaque values. <spec> is
        TypeName or TypeName:0 or TypeName:1:2 (0-based type parameter indices).
        With no indices, all type parameters of that declaration are consumer slots.

  Resolves files with fast-glob, runs readTypes per file, then reports
  getOpaqueViolations() for each provided opaque type identity (each run
  receives the same --consumer list).

  --opaque and globs may appear in any order. Exit 1 if any violation, if
  no --opaque is provided, if globs are missing, or if no files match.`)
	process.exit(1)
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
	snippetContext: SnippetContext,
): void {
	const renderedMessage = renderOpaqueMessage(violation.message)
	if (!violation.ref || !violation.file) {
		console.error(`opaque-check: ${renderedMessage.primary}`)
		if (renderedMessage.note) printIndentedStderr(`note: ${renderedMessage.note}`)
		return
	}
	console.error(
		formatDiagnosticHeader(
			violation.file,
			violation.ref.pos.line,
			violation.ref.pos.column,
			renderedMessage.primary,
		),
	)
	if (renderedMessage.note) {
		printIndentedStderr(`note: ${renderedMessage.note}`)
	}
	console.error()
	printReferenceSnippet(sourcesByPath, types, violation.file, violation.ref, snippetContext)
	if (isDuplicateUsageViolation(violation.message) && violation.relatedFile && violation.relatedRef) {
		printIndentedStderr(
			formatDiagnosticHeader(
				violation.relatedFile,
				violation.relatedRef.pos.line,
				violation.relatedRef.pos.column,
				"first usage here",
			),
		)
		printIndentedStderr("")
		printReferenceSnippet(sourcesByPath, types, violation.relatedFile, violation.relatedRef, snippetContext, true)
	}
}

const DIAG_INDENT = "    "

function printIndentedStderr(line: string): void {
	console.error(`${DIAG_INDENT}${line}`)
}

function printIndentedStderrBlock(text: string): void {
	for (const line of text.split("\n")) printIndentedStderr(line)
}

type SnippetContext = {
	beforeLines: number
	afterLines: number
}

function printReferenceSnippet(
	sourcesByPath: Map<string, string>,
	types: Map<string, TypeEntry>,
	file: string,
	ref: NonNullable<ReturnType<typeof getOpaqueViolations>[number]["ref"]>,
	snippetContext: SnippetContext,
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
			{
				contextBefore: Math.max(0, snippetContext.beforeLines - 1),
				contextAfter: snippetContext.afterLines,
				tabWidth: DEFAULT_SNIPPET_TAB_WIDTH,
			},
		),
	)
	line("")
}

const DEFAULT_SNIPPET_CONTEXT: SnippetContext = { beforeLines: 4, afterLines: 0 }

function parseNonNegativeInt(value: string): number | undefined {
	if (value.length === 0) return undefined
	if (!/^\d+$/.test(value)) return undefined
	const parsed = Number.parseInt(value, 10)
	return Number.isFinite(parsed) ? parsed : undefined
}

function parseSnippetContext(value: string): SnippetContext {
	const [rawBefore, rawAfter, ...rest] = value.split(":")
	if (rest.length > 0) throw new OpaqueCliParseError("invalid --snippet-lines value (expected <before>[:<after>])")
	const beforeParsed = parseNonNegativeInt(rawBefore ?? "")
	const afterParsed = rawAfter === undefined ? undefined : parseNonNegativeInt(rawAfter)
	if ((rawBefore ?? "").length > 0 && beforeParsed === undefined) {
		throw new OpaqueCliParseError("invalid --snippet-lines <before> (expected integer >= 0)")
	}
	if (rawAfter !== undefined && rawAfter.length > 0 && afterParsed === undefined) {
		throw new OpaqueCliParseError("invalid --snippet-lines <after> (expected integer >= 0)")
	}
	const beforeLines = beforeParsed ?? DEFAULT_SNIPPET_CONTEXT.beforeLines
	const afterLines = afterParsed ?? DEFAULT_SNIPPET_CONTEXT.afterLines
	if (beforeLines < 1) {
		throw new OpaqueCliParseError("invalid --snippet-lines <before> (expected integer >= 1)")
	}
	return { beforeLines, afterLines }
}

function parseSnippetLinesArg(argv: readonly string[]): { cleanedArgv: string[]; snippetContext: SnippetContext } {
	const cleanedArgv: string[] = []
	let snippetContext = DEFAULT_SNIPPET_CONTEXT
	for (let index = 0; index < argv.length; index++) {
		const token = argv[index]
		if (token === "--snippet-lines") {
			const value = argv[index + 1]
			if (!value) throw new OpaqueCliParseError("missing value for --snippet-lines (expected <before>[:<after>])")
			snippetContext = parseSnippetContext(value)
			index += 1
			continue
		}
		if (token) cleanedArgv.push(token)
	}
	return { cleanedArgv, snippetContext }
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
			primary: `Type "${variable}" is reused in one ternary branch here.`,
			note: "Use each opaque-constrained value at most once per branch.",
		}
	}
	if (message.includes("cannot be used more than once in one conditional body")) {
		return {
			primary: `Type "${variable}" is reused in one conditional body here.`,
			note: "A conditional body cannot consume the same opaque-constrained value twice.",
		}
	}
	if (message.includes("cannot be used more than once outside ternary body")) {
		return {
			primary: `Type "${variable}" is reused outside ternary branches here.`,
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
	if (message.includes("without a configured opaque or consumer extends only")) {
		const callee =
			message.match(/generic (\S+) without a configured opaque or consumer extends only/)?.[1] ?? "generic"
		return {
			primary: `Type "${variable}" cannot be passed to "${callee}".`,
			note: "The callee parameter must extend only a configured opaque or consumer type.",
		}
	}
	if (message.includes("that destructures this argument")) {
		const callee = message.match(/generic (\S+) that destructures this argument/)?.[1] ?? "generic"
		return {
			primary: `Type "${variable}" cannot be passed to "${callee}".`,
			note: "The callee destructures this opaque-constrained argument.",
		}
	}
	if (message.includes("cannot be consumed by") && message.includes("more than once in the same branch")) {
		const m = message.match(
			/^Opaque-constrained type variable (\S+) cannot be consumed by (\S+) more than once in the same branch$/,
		)
		const consumer = m?.[2] ?? "consumer"
		return {
			primary: `Type "${variable}" is consumed by "${consumer}" more than once in one branch here.`,
			note: "Registered opaque consumers may appear at most once per opaque argument per branch.",
		}
	}
	return { primary: message }
}

function isDuplicateUsageViolation(message: string): boolean {
	return (
		message.includes("cannot be used more than once in the same ternary branch") ||
		message.includes("cannot be used more than once in one conditional body") ||
		message.includes("cannot be used more than once outside ternary body") ||
		(message.includes("cannot be consumed by") && message.includes("more than once in the same branch"))
	)
}

async function main() {
	let parsed: ReturnType<typeof parseOpaqueCliArgs>
	let snippetContext = DEFAULT_SNIPPET_CONTEXT
	try {
		const parsedSnippetArg = parseSnippetLinesArg(process.argv.slice(2))
		snippetContext = parsedSnippetArg.snippetContext
		parsed = parseOpaqueCliArgs(parsedSnippetArg.cleanedArgv)
	} catch (err) {
		if (err instanceof OpaqueCliParseError) {
			console.error(err.message)
			usage()
		}
		throw err
	}
	const { opaqueTypes, opaqueConsumers, globs } = parsed
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
	const violations = opaqueTypes.flatMap(opaqueType =>
		getOpaqueViolations(result, { ...opaqueType, opaqueConsumers }),
	)

	if (violations.length > 0) {
		const filesWithViolations = new Set<string>()
		for (const [index, violation] of violations.entries()) {
			if (index > 0) console.error()
			if (violation.file) filesWithViolations.add(normalizeLogicalPath(violation.file))
			printViolationSnippet(sourcesByPath, types, violation, snippetContext)
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
