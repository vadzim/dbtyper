#!/usr/bin/env node
// CLI: glob → read each file (keep sources by logical path) → readTypes → getConsumingViolations.
// Example: node src/type-checker/check-consumption.ts "src/type-checker/tests/borrow-checker.test.ts"
import { readFile } from "node:fs/promises"
import { inspect } from "node:util"
import fg from "fast-glob"
import path from "node:path"
import { getConsumingViolations, type ConsumingViolation } from "./borrow-checker.ts"
import { DEFAULT_SNIPPET_TAB_WIDTH, formatSourceSnippet } from "./format-source-snippet.ts"
import { readTypes, type ReadTypesResult, type ScopeEntry, type TypeEntry, type TypeReference } from "./read-types.ts"

function usage(): never {
	console.error(`Usage: node src/type-checker/check-consumption.ts <glob> [glob...]

  Resolves files with fast-glob, runs readTypes per file, then reports
  getConsumingViolations() (@consume overlap). Exit 1 if any violation or if no globs.`)
	process.exit(1)
}

/** Same logical path key as readTypes uses for TypeEntry.file. */
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
		const part = readTypes(filePath, content, { idPrefix: `f${index}:` })
		combined.types.push(...part.types)
		combined.scopes.push(...part.scopes)
	}

	return { result: combined, sourcesByPath }
}

function indexById<T extends { id: string }>(entries: readonly T[]): Map<string, T> {
	return new Map(entries.map(e => [e.id, e]))
}

function rootScopes(scopes: Map<string, ScopeEntry>): ScopeEntry[] {
	const childIds = new Set<string>()
	for (const s of scopes.values()) {
		for (const ch of s.children) childIds.add(ch.scopeId)
	}
	return [...scopes.values()].filter(s => !childIds.has(s.id))
}

function refMatches(a: TypeReference, b: TypeReference): boolean {
	return a.pos.start === b.pos.start && a.typeId === b.typeId
}

function findScopeFileContainingRef(scopes: Map<string, ScopeEntry>, ref: TypeReference): string | undefined {
	function walk(scopeId: string): string | undefined {
		const s = scopes.get(scopeId)
		if (!s) return undefined
		if (s.refs.some(r => refMatches(r, ref))) return s.file
		for (const call of s.calls) {
			for (const arg of call.arguments) {
				if (arg.refs.some(r => refMatches(r, ref))) return s.file
			}
		}
		for (const ch of s.children) {
			const f = walk(ch.scopeId)
			if (f !== undefined) return f
		}
		return undefined
	}
	for (const root of rootScopes(scopes)) {
		const f = walk(root.id)
		if (f !== undefined) return f
	}
	return undefined
}

const DIAG_INDENT = "    "

function printIndentedStderr(line: string): void {
	console.error(`${DIAG_INDENT}${line}`)
}

function printIndentedStderrBlock(text: string): void {
	for (const line of text.split("\n")) console.error(`${DIAG_INDENT}${line}`)
}

function typeEntryDeclarationRef(entry: TypeEntry): TypeReference {
	return { typeId: entry.id, pos: entry.pos }
}

function printLocatedTypeSnippet(
	sourcesByPath: Map<string, string>,
	types: Map<string, TypeEntry>,
	file: string | undefined,
	ref: TypeReference,
	message: string,
	outline = false,
): void {
	const line = outline ? printIndentedStderr : (s: string) => console.error(s)
	const block = outline ? printIndentedStderrBlock : (s: string) => console.error(s)

	if (file === undefined) {
		line(`(unknown file):${ref.pos.line}:${ref.pos.column}: ${message}`)
		line(`(no scope file for ref; snippet omitted) ${ref.typeId} ${inspect(ref.pos)}`)
		console.error()
		return
	}
	const t = types.get(ref.typeId)
	const source = sourcesByPath.get(normalizeLogicalPath(file)) ?? sourcesByPath.get(file)
	if (t === undefined || source === undefined) {
		line(`${file}:${ref.pos.line}:${ref.pos.column}: ${message}`)
		line(`(no source for ref; snippet omitted) ${ref.typeId} ${file}`)
		console.error()
		return
	}
	const loc = `${file}:${ref.pos.line}:${ref.pos.column}`
	line(`${loc}: ${message}`)
	console.error()
	block(
		formatSourceSnippet(
			source,
			{
				line: ref.pos.line,
				startPos: ref.pos.start,
				textLength: t.name.length > 0 ? t.name.length : 1,
			},
			{ tabWidth: DEFAULT_SNIPPET_TAB_WIDTH },
		),
	)
	console.error()
}

type CommonIdRelation = "both-ends" | "err-only" | "borrowed-only" | "neither-end"

function commonIdRelation(v: ConsumingViolation): CommonIdRelation {
	const common = new Set(v.commonIds)
	const errIn = common.has(v.errorneousUsage.typeId)
	const borrowedIn = common.has(v.borrowedValue.typeId)
	if (errIn && borrowedIn) return "both-ends"
	if (errIn && !borrowedIn) return "err-only"
	if (!errIn && borrowedIn) return "borrowed-only"
	return "neither-end"
}

function sameBranchReuseRule(): string {
	return "within the same ternary branch or type body."
}

function messageUsageSite(types: Map<string, TypeEntry>, v: ConsumingViolation): string {
	const err = types.get(v.errorneousUsage.typeId)?.name ?? "(unknown type)"
	return `Type "${err}" appears here after it was consumed.`
}

function messageConsumptionSite(types: Map<string, TypeEntry>, v: ConsumingViolation, rel: CommonIdRelation): string {
	const err = types.get(v.errorneousUsage.typeId)?.name ?? "(unknown type)"
	const borrowed = types.get(v.borrowedValue.typeId)?.name ?? "(unknown type)"
	const consumer = types.get(v.borrower.typeId)?.name ?? v.borrower.typeId
	switch (rel) {
		case "err-only":
		case "borrowed-only":
			return `Type "${err}" is inferred from "${borrowed}", which type "${consumer}" consumes at this call, ${sameBranchReuseRule()}`
		case "neither-end": {
			const rootId = v.commonIds[0]
			const rootName = (rootId !== undefined ? types.get(rootId)?.name : undefined) ?? "(unknown type)"
			return `Type "${err}" and "${borrowed}" both trace to "${rootName}"; type "${consumer}" consumes type "${borrowed}" here, ${sameBranchReuseRule()}`
		}
		default:
			return `Type "${borrowed}" is consumed here by type "${consumer}", ${sameBranchReuseRule()}`
	}
}

function messageSharedRootDeclaration(_types: Map<string, TypeEntry>, _v: ConsumingViolation, decl: TypeEntry): string {
	const root = decl.name || "(anonymous)"
	return `Type "${root}" is declared here`
}

async function main() {
	const globs = process.argv.slice(2).filter(a => a.length > 0)
	if (globs.length === 0) usage()

	const paths = await fg(globs, { onlyFiles: true, unique: true })
	if (paths.length === 0) {
		console.error("No files matched the given glob(s).")
		process.exit(1)
	}

	const { result, sourcesByPath } = await readTypesWithSources(paths)
	const types = indexById(result.types)
	const scopes = indexById(result.scopes)
	const violations = [...getConsumingViolations(result)]

	if (violations.length > 0) {
		const filesWithViolations = new Set<string>()
		for (const [i, v] of violations.entries()) {
			if (i > 0) console.error()
			const rel = commonIdRelation(v)
			const usageFile = findScopeFileContainingRef(scopes, v.errorneousUsage)
			if (usageFile !== undefined) filesWithViolations.add(normalizeLogicalPath(usageFile))
			printLocatedTypeSnippet(sourcesByPath, types, usageFile, v.errorneousUsage, messageUsageSite(types, v))
			const borrowedFile = findScopeFileContainingRef(scopes, v.borrowedValue)
			if (borrowedFile !== undefined) filesWithViolations.add(normalizeLogicalPath(borrowedFile))
			printLocatedTypeSnippet(
				sourcesByPath,
				types,
				borrowedFile,
				v.borrowedValue,
				messageConsumptionSite(types, v, rel),
				true,
			)
			if (rel === "neither-end") {
				const rootId = v.commonIds[0]
				const decl = rootId !== undefined ? types.get(rootId) : undefined
				if (decl !== undefined) {
					if (decl.file !== undefined) filesWithViolations.add(normalizeLogicalPath(decl.file))
					printLocatedTypeSnippet(
						sourcesByPath,
						types,
						decl.file,
						typeEntryDeclarationRef(decl),
						messageSharedRootDeclaration(types, v, decl),
						true,
					)
				}
			}
		}
		const n = violations.length
		const f = filesWithViolations.size
		const errorLabel = n === 1 ? "error" : "errors"
		const fileLabel = f === 1 ? "file" : "files"
		console.error(`\nFound ${n} ${errorLabel} in ${f} ${fileLabel}.`)
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
