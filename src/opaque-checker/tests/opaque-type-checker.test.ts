import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readTypes } from "../read-types.ts"
import { getOpaqueViolations, parseConsumeTypeSpec } from "../opaque-type-checker.ts"

describe("parseConsumeTypeSpec", () => {
	it("parses type name only (all consumer type parameters)", () => {
		assert.deepEqual(parseConsumeTypeSpec("MyConsumer"), { typeName: "MyConsumer" })
	})

	it("parses a single 0-based index", () => {
		assert.deepEqual(parseConsumeTypeSpec("MyConsumer:0"), { typeName: "MyConsumer", typeArgumentIndexes: [0] })
	})

	it("parses multiple colon-separated indexes", () => {
		assert.deepEqual(parseConsumeTypeSpec("MyConsumer:1:2"), { typeName: "MyConsumer", typeArgumentIndexes: [1, 2] })
	})
})

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
type BadOneBody<T extends Opaque> = Call<T> extends infer U ? T : T
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
type BadNestedBranch<T extends Opaque> = 1 extends number ? (Call<T> extends infer U ? T : T) : false
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

	it("allows passing opaque T when callee parameter extends Opaque only", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-pass-extends-opaque-only.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type A<T extends Opaque> = T
type B<T extends Opaque> = A<T>
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.equal(violations.length, 0)
	})

	it("flags passing opaque T to generic with unconstrained parameter", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-fail-unconstrained.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type A<T> = T
type B<T extends Opaque> = A<T>
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("without a configured opaque or consumer extends only")))
	})

	it("flags passing opaque T to generic with extends unknown", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-fail-extends-unknown.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type A<T extends unknown> = T
type B<T extends Opaque> = A<T>
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("without a configured opaque or consumer extends only")))
	})

	it("flags passing opaque T to generic when callee extends a type other than Opaque only", () => {
		const opaqueFileName = "./opaque.ts"
		const result = readTwoFileProgram({
			opaqueFileName,
			usageFileName: "./opaque-fail-extends-other.ts",
			usageSource: `
import type { Opaque } from "./opaque.ts"
type A<T extends string> = T
type B<T extends Opaque> = A<T>
`,
		})
		const violations = getOpaqueViolations(result, { fileName: opaqueFileName, typeName: "Opaque" })

		assert.ok(violations.some(v => v.message.includes("without a configured opaque or consumer extends only")))
	})

	it("allows passing opaque T when callee extends a registered opaque consumer type only", () => {
		const opaqueFileName = "./opaque.ts"
		const consumerFileName = "./consumer-alias.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consumerSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer = Opaque & { __consumer?: never }
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Consumer } from "./consumer-alias.ts"
type A<T extends Consumer> = T
type B<T extends Opaque> = A<T>
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consumerFileName, consumerSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-consumer.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consumerFileName, typeName: "Consumer" }],
		})

		assert.equal(violations.length, 0)
	})

	it("consumer generic: all slots consume — flags passing opaque into second slot without matching constraint", () => {
		const opaqueFileName = "./opaque.ts"
		const dualFileName = "./dual-generic.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const dualSource = `
import type { Opaque } from "./opaque.ts"
export type Dual<A extends Opaque, B> = [A, B]
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Dual } from "./dual-generic.ts"
type Use<T extends Opaque, U extends Opaque> = Dual<T, U>
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(dualFileName, dualSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-dual.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: dualFileName, typeName: "Dual" }],
		})

		assert.ok(violations.some(v => v.message.includes("without a configured opaque or consumer extends only")))
	})

	it("consumer generic: only index 0 — allows passing opaque into second slot when it is not a consumer slot", () => {
		const opaqueFileName = "./opaque.ts"
		const dualFileName = "./dual-generic.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const dualSource = `
import type { Opaque } from "./opaque.ts"
export type Dual<A extends Opaque, B> = [A, B]
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Dual } from "./dual-generic.ts"
type Use<T extends Opaque, U extends Opaque> = Dual<T, U>
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(dualFileName, dualSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-dual.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: dualFileName, typeName: "Dual", typeArgumentIndexes: [0] }],
		})

		assert.equal(violations.length, 0)
	})

	it("consumer generic: only index 1 — allows passing opaque into first slot when it is not a consumer slot", () => {
		const opaqueFileName = "./opaque.ts"
		const dualFileName = "./dual-generic.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const dualSource = `
import type { Opaque } from "./opaque.ts"
export type Dual<A, B extends Opaque> = [A, B]
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Dual } from "./dual-generic.ts"
type Use<T extends Opaque, U extends Opaque> = Dual<T, U>
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(dualFileName, dualSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-dual.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: dualFileName, typeName: "Dual", typeArgumentIndexes: [1] }],
		})

		assert.equal(violations.length, 0)
	})

	it("consumer linearity: single consumer use in a branch passes", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./consumer-linear.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer<T extends Opaque> = T
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Consumer } from "./consumer-linear.ts"
type Ok<T extends Opaque> = 1 extends number ? Consumer<T> : never
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-linear.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.equal(violations.length, 0)
	})

	it("consumer linearity: two consumer calls on same opaque in one branch fails", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./consumer-linear.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer<T extends Opaque> = T
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Consumer } from "./consumer-linear.ts"
type Bad<T extends Opaque> = 1 extends number ? [Consumer<T>, Consumer<T>] : never
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-linear.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.ok(
			violations.some(
				v =>
					v.message.includes("cannot be consumed by") &&
					v.message.includes("more than once in the same branch"),
			),
		)
	})

	it("consumer linearity: two consumer calls in same inner branch fails (nested conditional)", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./consumer-linear.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer<T extends Opaque> = T
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Consumer } from "./consumer-linear.ts"
type Bad<T extends Opaque> = 1 extends number
	? (1 extends number ? [Consumer<T>, Consumer<T>] : never)
	: never
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-linear.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.ok(
			violations.some(
				v =>
					v.message.includes("cannot be consumed by") &&
					v.message.includes("more than once in the same branch"),
			),
		)
	})

	it("consumer linearity: consumer in both branches of a conditional passes", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./consumer-linear.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer<T extends Opaque> = T
export type Other<T extends Opaque> = T
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Consumer, Other } from "./consumer-linear.ts"
type Ok<T extends Opaque> = 1 extends number ? Consumer<T> : Other<T>
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-linear.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.equal(violations.length, 0)
	})

	it("consumer linearity: one Dual call with two opaque args passes; two Dual calls on same slot fails with Dual:0", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./consumer-linear-dual.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Dual<A extends Opaque, B extends Opaque> = [A, B]
`
		const passSource = `
import type { Opaque } from "./opaque.ts"
import type { Dual } from "./consumer-linear-dual.ts"
type Ok<T extends Opaque, U extends Opaque> = 1 extends number ? Dual<T, U> : never
`
		const failSource = `
import type { Opaque } from "./opaque.ts"
import type { Dual } from "./consumer-linear-dual.ts"
type Bad<T extends Opaque, U extends Opaque> = 1 extends number ? [Dual<T, U>, Dual<T, U>] : never
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const partPass = readTypes("./usage-dual-pass.ts", passSource, { includeAst: true, idPrefix: "f2:" })
		const resultPass = {
			types: [...part0.types, ...part1.types, ...partPass.types],
			scopes: [...part0.scopes, ...part1.scopes, ...partPass.scopes],
		}
		const vPass = getOpaqueViolations(resultPass, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Dual", typeArgumentIndexes: [0, 1] }],
		})
		assert.equal(vPass.length, 0)

		const partFail = readTypes("./usage-dual-fail.ts", failSource, { includeAst: true, idPrefix: "f3:" })
		const resultFail = {
			types: [...part0.types, ...part1.types, ...partFail.types],
			scopes: [...part0.scopes, ...part1.scopes, ...partFail.scopes],
		}
		const vFail = getOpaqueViolations(resultFail, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Dual", typeArgumentIndexes: [0] }],
		})
		assert.ok(
			vFail.some(
				v =>
					v.message.includes("cannot be consumed by") &&
					v.message.includes("more than once in the same branch"),
			),
		)
	})

	it("derived consumer: wrapper over Consumer(T) is a consumer; Y(T) twice in one branch fails", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./derived-consumer-wrap.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer<T extends Opaque> = T
export type X<T extends Opaque> = Consumer<T>
export type Y<T extends Opaque> = X<T>
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Y } from "./derived-consumer-wrap.ts"
type Bad<T extends Opaque> = 1 extends number ? [Y<T>, Y<T>] : never
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-derived-wrap.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.ok(
			violations.some(
				v =>
					v.message.includes("cannot be consumed by") &&
					v.message.includes("more than once in the same branch"),
			),
		)
	})

	it("derived consumer: Y(T) in both conditional branches passes (separate branches)", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./derived-consumer-branches.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer<T extends Opaque> = T
export type X<T extends Opaque> = Consumer<T>
export type Y<T extends Opaque> = X<T>
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { Y } from "./derived-consumer-branches.ts"
type Ok<T extends Opaque> = 1 extends number ? Y<T> : Y<T>
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-derived-branches.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.equal(violations.length, 0)
	})

	it("derived consumer: Consumer(A<T)) does not derive; X(T) twice does not trigger consumer linearity", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./derived-consumer-at.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type A<T extends Opaque> = T
export type Consumer<T extends Opaque> = T
export type X<T extends Opaque> = Consumer<A<T>>
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { X } from "./derived-consumer-at.ts"
type Ok<T extends Opaque> = 1 extends number ? [X<T>, X<T>] : never
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-derived-at.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.equal(violations.length, 0)
	})

	it("derived consumer: Consumer([T]) does not derive", () => {
		const opaqueFileName = "./opaque.ts"
		const consFileName = "./derived-consumer-tuple.ts"
		const opaqueSource = `export type Opaque = string & { __opaqueBrand?: never }\n`
		const consSource = `
import type { Opaque } from "./opaque.ts"
export type Consumer<T extends Opaque> = T
export type X<T extends Opaque> = Consumer<[T]>
`
		const usageSource = `
import type { Opaque } from "./opaque.ts"
import type { X } from "./derived-consumer-tuple.ts"
type Ok<T extends Opaque> = 1 extends number ? [X<T>, X<T>] : never
`
		const part0 = readTypes(opaqueFileName, opaqueSource, { includeAst: true, idPrefix: "f0:" })
		const part1 = readTypes(consFileName, consSource, { includeAst: true, idPrefix: "f1:" })
		const part2 = readTypes("./usage-derived-tuple.ts", usageSource, { includeAst: true, idPrefix: "f2:" })
		const result = {
			types: [...part0.types, ...part1.types, ...part2.types],
			scopes: [...part0.scopes, ...part1.scopes, ...part2.scopes],
		}
		const violations = getOpaqueViolations(result, {
			fileName: opaqueFileName,
			typeName: "Opaque",
			opaqueConsumers: [{ fileName: consFileName, typeName: "Consumer" }],
		})
		assert.equal(violations.length, 0)
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
