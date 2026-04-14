import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readTypes } from "../read-types.ts"
import { getOpaqueViolations } from "../opaque-type-checker.ts"

const VALID_SOURCES = [
	`
// allows usage when call result is checked and infer has opaque extends
type Call<T extends Opaque> = [1, T]
type OkCallUsage<T extends Opaque, A> = Call<T> extends [A, infer U extends Opaque] ? true : false
`,
	`
// allows usage when call result is checked and inferred without opaque extends
type Call<T extends Opaque> = [1, T]
type OkCallUsageInfer<T extends Opaque> = Call<T> extends infer U ? true : false
`,
	`
// allows passing opaque T when callee parameter extends Opaque only
type A<T extends Opaque> = T
type B<T extends Opaque> = A<T>
`,
] as const

const OPAQUE_FILE_NAME = "./opaque.ts"
const OPAQUE_TYPE_NAME = "Opaque"
const OPAQUE_SOURCE = `export type Opaque = string & { __opaqueBrand?: never }\n`

function testNameFromSource(source: string, fallback: string): string {
	const match = source.match(/^\s*\/\/\s*(.+?)\s*$/m)
	return match?.[1] ?? fallback
}

function buildProgram(usageFileName: string, usageSource: string) {
	const part0 = readTypes(OPAQUE_FILE_NAME, OPAQUE_SOURCE, { includeAst: true, idPrefix: "f0:" })
	const part1 = readTypes(usageFileName, usageSource, { includeAst: true, idPrefix: "f1:" })
	return {
		types: [...part0.types, ...part1.types],
		scopes: [...part0.scopes, ...part1.scopes],
	}
}

describe("getOpaqueViolations valid cases", () => {
	for (const [index, source] of VALID_SOURCES.entries()) {
		const name = testNameFromSource(source, `valid case ${index + 1}`)
		it(name, () => {
			const result = buildProgram(
				`./valid-case-${index + 1}.ts`,
				`import type { Opaque } from "./opaque.ts"\n` + source,
			)
			const violations = getOpaqueViolations(result, { fileName: OPAQUE_FILE_NAME, typeName: OPAQUE_TYPE_NAME })
			assert.equal(violations.length, 0)
		})
	}
})

it("does not check opaque-constrained usage in the opaque module itself", () => {
	const result = readTypes(
		"./opaque.ts",
		`
// does not check opaque-constrained usage in the opaque module itself
export type Opaque = string & { __opaqueBrand?: never }
type LocalBad<T extends Opaque> = T extends number ? 1 : 0
`,
		{ includeAst: true, idPrefix: "f0:" },
	)
	const violations = getOpaqueViolations(result, { fileName: OPAQUE_FILE_NAME, typeName: OPAQUE_TYPE_NAME })
	assert.equal(violations.length, 0)
})
