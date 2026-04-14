import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readTypes } from "../read-types.ts"
import { getOpaqueViolations } from "../opaque-type-checker.ts"

describe("getOpaqueViolations", () => {
	it("flags generic param constrained by opaque type when used in extends condition", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-check-generic.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type BadGeneric<T extends Opaque> = T extends number ? 1 : 0
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.length > 0)
	})

	it("flags infer param constrained by opaque type when used in extends condition", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-check-infer.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type BadInfer<T> = T extends infer U extends Opaque ? (U extends number ? 1 : 0) : 0
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.length > 0)
	})

	it("flags direct destructuring of opaque-constrained parameter in extends check", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-destructure-direct.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type BadDestructure<T extends Opaque> = T extends [infer U] ? true : false
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("cannot be used in extends condition")))
	})

	it("flags direct infer reassignment pattern in extends check", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-reassign-direct.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type BadReassign<T extends Opaque> = T extends infer U ? true : false
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("cannot be used in extends condition")))
	})

	it("allows usage when call result is checked and infer has opaque extends", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-call-usage-with-extends.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type Call<T extends Opaque> = [1, T]
type OkCallUsage<T extends Opaque, A> = Call<T> extends [A, infer U extends Opaque] ? true : false
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.equal(violations.length, 0)
	})

	it("allows usage when call result is checked and inferred without opaque extends", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-call-usage-infer.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type Call<T extends Opaque> = [1, T]
type OkCallUsageInfer<T extends Opaque> = Call<T> extends infer U ? true : false
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.equal(violations.length, 0)
	})

	it("flags two usages in one conditional body (condition and true branch)", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-two-usages-one-body.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type Call<T extends Opaque> = [T]
type Call2<T extends Opaque> = T
type BadOneBody<T extends Opaque> = Call<T> extends infer U ? Call2<T> : false
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("one conditional body")))
	})

	it("flags two usages in one outer ternary branch via nested conditional", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-two-usages-nested-branch.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type Call<T extends Opaque> = [T]
type Call2<T extends Opaque> = T
type BadNestedBranch<T extends Opaque> = 1 extends number ? (Call<T> extends infer U ? Call2<T> : false) : false
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("one conditional body")))
	})

	it("flags repeated usage in same ternary branch for generic param", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-reuse.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type BadBranch<T extends Opaque> = 1 extends number ? [T, T] : 0
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("same ternary branch")))
	})

	it("flags repeated usage outside ternary body for generic param", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-outside.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type BadOutside<T extends Opaque> = [T, T]
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("outside ternary body")))
	})

	it("flags repeated usage in same ternary branch for infer param", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-infer-reuse.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type BadInferBranch<T> = T extends infer U extends Opaque ? [U, U] : 0
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("same ternary branch")))
	})

	it("allows opaque generic param with 3 ternaries and 4 branches (one use per branch)", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-branch-both-sides.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type OkBranchFourLeaves<T extends Opaque, A, B, C> = A extends 1 ? (B extends 1 ? T : T) : (C extends 1 ? T : T)
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.equal(violations.filter(v => v.message.includes("same ternary branch")).length, 0)
	})

	it("allows opaque inferred var with 3 ternaries and 4 branches (one use per branch)", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-infer-branch-both-sides.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type OkInferFourLeaves<T, A, B, C> = T extends infer U extends Opaque
	? A extends 1
		? (B extends 1 ? U : U)
		: (C extends 1 ? U : U)
	: never
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.equal(violations.filter(v => v.message.includes("same ternary branch")).length, 0)
	})

	it("flags passing opaque-constrained variable to generic without opaque extends", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-generic-no-extends.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type NoOpaqueConstraint<T> = T
type Use<T extends Opaque> = NoOpaqueConstraint<T>
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("without extends constraint")))
	})

	it("flags passing opaque-constrained variable to generic that destructures argument", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-generic-destructure.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type Destructure<T extends Opaque> = T extends [infer A, infer B] ? [A, B] : T
type Use<T extends Opaque> = Destructure<T>
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("destructures this argument")))
	})

	it("does not check opaque-constrained usage in the opaque module itself", () => {
		const opaqueFileName = "./opaque.ts"
		const source = `
export type Opaque = string & { __opaqueBrand?: never }
type LocalBad<T extends Opaque> = T extends number ? 1 : 0
`
		const result = readSingleFileProgram(opaqueFileName, source)
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.equal(violations.length, 0)
	})
})

function readTwoFileProgram({
	opaqueFileName,
	usageFileName,
	usageSource,
}: {
	opaqueFileName: string
	usageFileName: string
	usageSource: string
}) {
	const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
	const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
	const part1 = readTypes(usageFileName, usageSource, { includeAst: true, idPrefix: "f1:" })
	return {
		types: [...part0.types, ...part1.types],
		scopes: [...part0.scopes, ...part1.scopes],
	}
}

function readSingleFileProgram(fileName: string, source: string) {
	return readTypes(fileName, source, { includeAst: true, idPrefix: "f0:" })
}
