import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readTypes } from "../read-types.ts"
import { getOpaqueViolations } from "../opaque-type-checker.ts"

const CASE_SOURCES: `\n// ${"allows" | "flags"} ${string}`[] = [
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
	`
// flags generic param constrained by opaque type when used in extends condition
type BadGeneric<T extends Opaque> = T extends number ? 1 : 0
`,
	`
// flags infer param constrained by opaque type when used in extends condition
type BadInfer<T> = T extends infer U extends Opaque ? (U extends number ? 1 : 0) : 0
`,
	`
// flags repeated usage in same ternary branch for generic param
type BadBranch<T extends Opaque> = 1 extends number ? [T, T] : 0
`,
	`
// flags repeated usage outside ternary body for generic param
type BadOutside<T extends Opaque> = [T, T]
`,
	`
// flags two usages in one conditional body
type Call<T extends Opaque> = [T]
type BadOneBody<T extends Opaque> = Call<T> extends infer U ? T : T
`,
	`
// flags passing opaque T to generic with unconstrained parameter
type A<T> = T
type B<T extends Opaque> = A<T>
`,
	`
// flags passing opaque T to generic with extends unknown
type A<T extends unknown> = T
type B<T extends Opaque> = A<T>
`,
	`
// flags passing opaque T to generic with non-opaque extends
type A<T extends string> = T
type B<T extends Opaque> = A<T>
`,
	`
// flags passing opaque-constrained variable to destructuring generic without extends
type Destructure<T> = T extends [infer A, infer B] ? [A, B] : T
type Use<T extends Opaque> = Destructure<T>
`,
] as const

const OPAQUE_FILE_NAME = "./opaque.ts"
const OPAQUE_TYPE_NAME = "Opaque"
const OPAQUE_SOURCE = `export type Opaque = string & { __opaqueBrand?: never }\n`

function testNameFromSource(source: string, fallback: string): string {
	const match = source.match(/^\s*\/\/\s*(.+?)\s*$/m)
	return match?.[1] ?? fallback
}

function getExpectationFromSourceName(name: string): "allows" | "flags" {
	if (name.startsWith("allows")) {
		return "allows"
	}
	if (name.startsWith("flags")) {
		return "flags"
	}
	assert.fail(`Expected test name to start with "allows" or "flags": ${name}`)
}

function buildProgram(usageFileName: string, usageSource: string) {
	const part0 = readTypes(OPAQUE_FILE_NAME, OPAQUE_SOURCE, { includeAst: true, idPrefix: "f0:" })
	const part1 = readTypes(usageFileName, usageSource, { includeAst: true, idPrefix: "f1:" })
	return {
		types: [...part0.types, ...part1.types],
		scopes: [...part0.scopes, ...part1.scopes],
	}
}

describe("getOpaqueViolations logic cases", () => {
	for (const [index, source] of CASE_SOURCES.entries()) {
		const name = testNameFromSource(source, `logic case ${index + 1}`)
		it(name, () => {
			const result = buildProgram(
				`./logic-case-${index + 1}.ts`,
				`import type { Opaque } from "./opaque.ts"\n` + source,
			)
			const violations = getOpaqueViolations(result, { fileName: OPAQUE_FILE_NAME, typeName: OPAQUE_TYPE_NAME })
			const expectation = getExpectationFromSourceName(name)
			if (expectation === "allows") {
				assert.equal(violations.length, 0)
				return
			}
			assert.ok(violations.length > 0)
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
