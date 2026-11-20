// Compiles TypeScript snippets in memory with the repository's own tsconfig and the TypeScript compiler API, the way
// `tsc --noEmit` would, and reports diagnostics with their exact range and the printed type of chosen variables.
// Used by the Checks that are about what the user sees in the editor (UX-5, UX-6, UX-8, UX-10).
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

export type SnippetDiagnostic = { line: number; start: number; length: number; text: string; message: string }
export type SnippetResult = { diagnostics: SnippetDiagnostic[]; types: Record<string, string> }

function compilerOptions(): ts.CompilerOptions {
	const read = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile)
	return ts.parseJsonConfigFileContent(read.config, ts.sys, root).options
}

/** Each snippet sits at `test/runtime/virtual/<name>.ts` (so `../../../src/...` imports work); it is never written to disk. */
export function compileSnippets(snippets: Record<string, string>): Record<string, SnippetResult> {
	const options = compilerOptions()
	const host = ts.createCompilerHost(options)
	const virtual = new Map<string, string>()
	for (const [name, text] of Object.entries(snippets)) {
		virtual.set(path.join(root, "test/runtime/virtual", `${name}.ts`), text)
	}
	const readFile = host.readFile.bind(host)
	const fileExists = host.fileExists.bind(host)
	const getSourceFile = host.getSourceFile.bind(host)
	host.readFile = f => virtual.get(f) ?? readFile(f)
	host.fileExists = f => virtual.has(f) || fileExists(f)
	host.getSourceFile = (f, lang, ...rest) =>
		virtual.has(f) ? ts.createSourceFile(f, virtual.get(f)!, lang) : getSourceFile(f, lang, ...rest)
	const program = ts.createProgram([...virtual.keys()], options, host)
	const checker = program.getTypeChecker()
	const out: Record<string, SnippetResult> = {}
	for (const [file, text] of virtual) {
		const sf = program.getSourceFile(file)!
		const diagnostics = ts.getPreEmitDiagnostics(program, sf).map(d => {
			const start = d.start ?? 0
			return {
				line: sf.getLineAndCharacterOfPosition(start).line + 1,
				start,
				length: d.length ?? 0,
				text: text.slice(start, start + (d.length ?? 0)),
				message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
			}
		})
		const types: Record<string, string> = {}
		sf.forEachChild(function visit(node) {
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
				types[node.name.text] = checker.typeToString(
					checker.getTypeAtLocation(node.name),
					undefined,
					ts.TypeFormatFlags.NoTruncation,
				)
			}
			ts.forEachChild(node, visit)
		})
		out[path.basename(file, ".ts")] = { diagnostics, types }
	}
	return out
}

export const header = `import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
`
