import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readTypes } from "../read-types.ts"

const readTypesWithAst = (...args: Parameters<typeof readTypes>) => {
	const [entryPath, entryContent, options] = args
	return readTypes(entryPath, entryContent, { includeAst: true, ...options })
}

describe("readTypes", () => {
	it("includes ast when includeAst is true", () => {
		const { types } = readTypes(
			"./with-ast.ts",
			`
          type A = string
        `,
			{ includeAst: true },
		)
		assert.ok(types.length > 0)
		assert.ok(types.every(typeEntry => typeEntry.ast !== undefined))
	})

	it("omits ast when includeAst is false", () => {
		const { types } = readTypes(
			"./without-ast.ts",
			`
          type A = string
        `,
			{ includeAst: false },
		)
		assert.ok(types.length > 0)
		assert.ok(types.every(typeEntry => typeEntry.ast === undefined))
	})

	it("omits ast by default", () => {
		const { types } = readTypes(
			"./default-no-ast.ts",
			`
          type A = string
        `,
		)
		assert.ok(types.length > 0)
		assert.ok(types.every(typeEntry => typeEntry.ast === undefined))
	})

	it("returns flat type entries with inline refs", () => {
		const filePath = "./a.ts"
		const { types: result, scopes } = readTypesWithAst(
			filePath,
			`
          import type { External } from "./ext"
          type UserId = string
          type Box<A extends UserId, B> = A
          type Combined = Box<{u:UserId, e:External[]}, [UserId, UserId]>
          interface User {
            id: UserId
            friend: External
          }
          function wrap<T>(value: T): { value: T } {
            return { value }
          }
          const payload: User | { temp: External } = { id: "x", friend: {} as External }
          class Repo extends BaseRepo<UserId> {
            data: User
            find(arg: External): UserId { return "x" }
          }
          type InferTest<T> = T extends Promise<infer V> ? V : T
        `,
		)

		assert.ok(Array.isArray(result))
		assert.ok(result.length > 0)
		assert.ok(Array.isArray(scopes))
		assert.ok(scopes.length > 0)

		const userId = result.find(x => x.name === "UserId")
		assert.ok(userId)

		const variableUnion = result.find(x => x.sourceKind === "variable" && x.ast?.kind === "union")
		assert.ok(variableUnion)
		assert.ok(variableUnion.ast)

		const unionRefs = variableUnion.ast.nodes
			?.flatMap(node => [node.refId, ...(node.nodes?.map(n => n.refId) ?? [])])
			.filter(Boolean)
		assert.ok(unionRefs && unionRefs.length > 0)

		const functionEntity = result.find(x => x.name === "wrap" && x.sourceKind === "functionEntity")
		assert.ok(functionEntity)
		assert.ok(functionEntity.ast)
		assert.equal(functionEntity.ast.kind, "typeofExpr")
		assert.equal(functionEntity.ast.text, "typeof wrap")

		const classEntity = result.find(x => x.name === "Repo" && x.sourceKind === "classEntity")
		assert.ok(classEntity)
		assert.ok(classEntity.ast)
		assert.equal(classEntity.ast.text, "typeof Repo")

		const inferBinding = result.find(x => x.sourceKind === "typeInfer" && x.name === "V")
		assert.ok(inferBinding)

		const scopedCalls = scopes.flatMap(scope => scope.calls)
		const userIdType = result.find(x => x.name === "UserId" && x.sourceKind === "typeDeclaration")
		const external = result.find(x => x.name === "External" && x.sourceKind === "typeImport")
		const boxType = result.find(x => x.name === "Box" && x.sourceKind === "typeDeclaration")
		assert.ok(userIdType)
		assert.ok(external)
		assert.ok(boxType)
		assert.ok(userIdType.refScopes.length > 0)
		assert.ok(userIdType.refScopes.every(refScope => scopes.some(scope => scope.id === refScope.scopeId)))
		const callWithTwoTypesInFirstArg = scopedCalls.find(
			call =>
				call.calleeTypeId === boxType.id &&
				call.arguments.length > 0 &&
				call.arguments[0] &&
				call.arguments[0].refs.length === 2 &&
				call.arguments[0].refs.some(ref => ref.typeId === userIdType.id) &&
				call.arguments[0].refs.some(ref => ref.typeId === external.id),
		)
		assert.ok(callWithTwoTypesInFirstArg)
		assert.equal(callWithTwoTypesInFirstArg.arguments.length, 2)
		assert.equal(callWithTwoTypesInFirstArg.arguments[1]?.refs.length, 2)
		assert.equal(callWithTwoTypesInFirstArg.arguments[1]?.refs[0]?.typeId, userIdType.id)
		assert.equal(callWithTwoTypesInFirstArg.arguments[1]?.refs[1]?.typeId, userIdType.id)
		assert.ok(callWithTwoTypesInFirstArg.arguments[1]?.refs[0]?.pos.start !== undefined)
		assert.ok(callWithTwoTypesInFirstArg.arguments[1]?.refs[1]?.pos.start !== undefined)
		const duplicatedUserIdRefsInScopes = scopes
			.flatMap(scope => scope.refs)
			.filter(ref => ref.typeId === userIdType.id)
		assert.ok(duplicatedUserIdRefsInScopes.length >= 2)
		assert.ok(duplicatedUserIdRefsInScopes.every(ref => ref.pos.start >= 0))
	})

	it("emits entries for plain identifier annotations too", () => {
		const filePath = "./b.ts"
		const { types: result } = readTypesWithAst(
			filePath,
			`
          type Name = string
          const v: Name = "ok"
          function get(a: Name): Name { return a }
        `,
		)

		const variable = result.find(x => x.sourceKind === "variable" && x.name === "v")
		assert.ok(variable)
		assert.ok(variable.ast)
		assert.equal(variable.ast.kind, "typeRef")
		assert.equal(variable.ast.refId !== undefined, true)

		const param = result.find(x => x.sourceKind === "functionParam" && x.name === "a")
		assert.ok(param)
		assert.ok(param.ast)
		assert.equal(param.ast.kind, "typeRef")
		assert.equal(param.ast.refId !== undefined, true)

		const ret = result.find(x => x.sourceKind === "functionReturn")
		assert.ok(ret)
		assert.ok(ret.ast)
		assert.equal(ret.ast.kind, "typeRef")
		assert.equal(ret.ast.refId !== undefined, true)
	})

	it("sets refFile for file 1 (types-3.ts)", () => {
		const { types } = readTypesWithAst(
			"./a/b/types-3.ts",
			`
          export type T = "x" | "y"
          export type Leaf</*@leaf*/ T extends string> = { value: T }
          export type InferLeaf<T extends string> = T extends Promise<infer T> ? { inner: T } : never
        `,
			{ idPrefix: "f1:" },
		)
		const imports = types.filter(x => x.sourceKind === "typeImport")
		assert.equal(imports.length, 0)
	})

	it("sets refFile for file 2 imports (types-2.ts)", () => {
		const { types } = readTypesWithAst(
			"./a/c/types-2.ts",
			`
          import type { Leaf } from "../b/types-3.ts"
          export type T = "x" | "z"
          export type Mid</*@mid*/ T extends string> = T extends "x" ?  { leaf: Leaf<"xx"> } : { leaf: Leaf<T> }
          export type InferMid<T extends string> = Mid<T> extends { leaf: infer T } ? T : never
        `,
			{ idPrefix: "f2:" },
		)
		const leafImport = types.find(x => x.sourceKind === "typeImport" && x.name === "Leaf")
		assert.ok(leafImport)
		assert.equal(leafImport.file, "./a/c/types-2.ts")
		assert.equal(leafImport.refFile, "./a/b/types-3.ts")
	})

	it("sets refFile for file 3 imports (types-1.ts)", () => {
		const { types } = readTypesWithAst(
			"./d/types-1.ts",
			`
          import type { Mid } from "../a/c/types-2.ts"
          export type T = "y" | "z"
          export type Top<T extends string> = { mid: Mid<T> }
          export type InferTop<T extends string> = Top<T> extends { mid: Mid<infer T> } ? T : never
          const v: Top<string> = { mid: { leaf: { value: "x" } } }
        `,
			{ idPrefix: "f3:" },
		)
		const midImport = types.find(x => x.sourceKind === "typeImport" && x.name === "Mid")
		assert.ok(midImport)
		assert.equal(midImport.file, "./d/types-1.ts")
		assert.equal(midImport.refFile, "./a/c/types-2.ts")
	})

	it("captures comments in typeArguments", () => {
		const { types } = readTypesWithAst(
			"./c/comments.ts",
			`
          type UserId = string
          type Name = string
          type Commented<
            /* first */
            A extends UserId,
            // second
            B extends Name,
            /* third-1 */
            // third-2
            C = A
          > = [A, B, C]
        `,
		)
		const commented = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "Commented")
		assert.ok(commented)
		assert.equal(commented.arguments.length, 3)
		assert.deepEqual(commented.arguments[0]?.comments, ["first"])
		assert.deepEqual(commented.arguments[1]?.comments, ["second"])
		assert.deepEqual(commented.arguments[2]?.comments, ["third-1", "third-2"])
	})

	it("creates exactly 3 scopes for ternary type", () => {
		const { scopes } = readTypesWithAst(
			"./ternary.ts",
			`
          type Ternary<T> = T extends string ? { ok: T } : { err: T }
        `,
		)
		const conditionalScopes = scopes.filter(
			scope =>
				scope.kind === "conditionalCondition" ||
				scope.kind === "conditionalTrueBranch" ||
				scope.kind === "conditionalFalseBranch",
		)
		assert.equal(conditionalScopes.length, 3)
		assert.equal(conditionalScopes.filter(scope => scope.kind === "conditionalCondition").length, 1)
		assert.equal(conditionalScopes.filter(scope => scope.kind === "conditionalTrueBranch").length, 1)
		assert.equal(conditionalScopes.filter(scope => scope.kind === "conditionalFalseBranch").length, 1)
	})

	it("sets correct refFile for relative and package imports", () => {
		const { types } = readTypesWithAst(
			"./f/imports.ts",
			`
          import type { LocalType } from "./types/local.ts"
          import type { ZodType } from "zod"
          type Uses = LocalType | ZodType
        `,
		)
		const localImport = types.find(x => x.sourceKind === "typeImport" && x.name === "LocalType")
		const packageImport = types.find(x => x.sourceKind === "typeImport" && x.name === "ZodType")
		assert.ok(localImport)
		assert.ok(packageImport)
		assert.equal(localImport.file, "./f/imports.ts")
		assert.equal(localImport.refFile, "./f/types/local.ts")
		assert.equal(packageImport.file, "./f/imports.ts")
		assert.equal(packageImport.refFile, "zod")
	})

	it("keeps file as provided entryPath", () => {
		const entryPath = "./folder/../entry.ts"
		const { types } = readTypesWithAst(
			entryPath,
			`
          type A = string
          import type { B } from "./types/b.ts"
          type U = A | B
        `,
		)
		assert.ok(types.length > 0)
		assert.ok(types.every(typeEntry => typeEntry.file === "./entry.ts"))
	})

	it("resolves relative refFile from provided file path only", () => {
		const { types } = readTypesWithAst(
			"./a/./c/types-2.ts",
			`
          import type { Leaf } from "../b/types-3.ts"
          type Mid = Leaf
        `,
		)
		const leafImport = types.find(x => x.sourceKind === "typeImport" && x.name === "Leaf")
		assert.ok(leafImport)
		assert.equal(leafImport.file, "./a/c/types-2.ts")
		assert.equal(leafImport.refFile, "./a/b/types-3.ts")
	})

	it("adds idPrefix to all type and scope ids", () => {
		const idPrefix = "pref:"
		const { types, scopes } = readTypesWithAst(
			"./prefix.ts",
			`
          type A = string
          type B<T> = T extends string ? A : never
        `,
			{ idPrefix },
		)
		assert.ok(types.length > 0)
		assert.ok(scopes.length > 0)
		assert.ok(types.every(typeEntry => typeEntry.id.startsWith(idPrefix)))
		assert.ok(scopes.every(scopeEntry => scopeEntry.id.startsWith(idPrefix)))
	})

	it("resolves # imports using imports option", () => {
		const { types } = readTypesWithAst(
			"./hash-imports.ts",
			`
          import type { User } from "#models/user"
          import type { Repo } from "#core/repo/main"
          type Uses = User | Repo
        `,
			{
				imports: {
					"#models/*": "./pkg/src/models/*.ts",
					"#core/repo/main": "./pkg/src/core/repo/main.ts",
				},
			},
		)
		const userImport = types.find(x => x.sourceKind === "typeImport" && x.name === "User")
		const repoImport = types.find(x => x.sourceKind === "typeImport" && x.name === "Repo")
		assert.ok(userImport)
		assert.ok(repoImport)
		assert.equal(userImport.refFile, "./pkg/src/models/user.ts")
		assert.equal(repoImport.refFile, "./pkg/src/core/repo/main.ts")
	})

	it("keeps reference arrays empty when there are no references", () => {
		const { types, scopes } = readTypesWithAst(
			"./isolated.ts",
			`
          type A = string
        `,
		)
		const isolatedType = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "A")
		assert.ok(isolatedType)
		assert.deepEqual(isolatedType.refScopes, [])
		assert.deepEqual(isolatedType.arguments, [])
		assert.ok(scopes.every(scope => Array.isArray(scope.refs)))
		assert.ok(scopes.every(scope => Array.isArray(scope.children)))
		assert.ok(scopes.every(scope => Array.isArray(scope.calls)))
		assert.ok(scopes.some(scope => scope.refs.length === 0))
	})

	it("fills reference arrays when references exist", () => {
		const { types, scopes } = readTypesWithAst(
			"./non-empty.ts",
			`
          type UserId = string
          type Box<T> = T
          type Use = Box<UserId>
          type Cond<T> = T extends string ? Box<T> : never
        `,
		)
		const userId = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "UserId")
		const box = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "Box")
		assert.ok(userId)
		assert.ok(box)
		assert.ok(userId.refScopes.length > 0)
		assert.ok(box.refScopes.length > 0)
		assert.ok(scopes.some(scope => scope.refs.length > 0))
		assert.ok(scopes.some(scope => scope.calls.length > 0))
		assert.ok(scopes.some(scope => scope.children.length > 0))
	})

	it("keeps all repeated refs for the same type in one scope", () => {
		const { types, scopes } = readTypesWithAst(
			"./scope-duplicate-refs.ts",
			`
          type UserId = string
          type Dup = [UserId, UserId, UserId]
        `,
		)
		const userId = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "UserId")
		const dup = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "Dup")
		assert.ok(userId)
		assert.ok(dup)
		const dupScope = scopes.find(scope => scope.id === dup.scopeId)
		assert.ok(dupScope)
		const refsToUserId = dupScope.refs.filter(ref => ref.typeId === userId.id)
		assert.equal(refsToUserId.length, 3)
		assert.ok(refsToUserId.every(ref => ref.pos.start >= 0))
	})

	it("keeps builtFrom empty for non-infer types", () => {
		const { types } = readTypesWithAst(
			"./built-from-non-infer.ts",
			`
          type A = string
          type B = number
          type C = A | B
        `,
		)
		const typeC = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "C")
		const typeA = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "A")
		const typeB = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "B")
		assert.ok(typeC)
		assert.ok(typeA)
		assert.ok(typeB)
		assert.deepEqual(typeC.builtFrom, [])
		assert.deepEqual(typeA.builtFrom, [])
		assert.deepEqual(typeB.builtFrom, [])
	})

	it("builds infer builtFrom from refs before extends for all infer bindings", () => {
		const { types } = readTypesWithAst(
			"./built-from-infer.ts",
			`
          type LeftA = { a: string }
          type LeftB = { b: number }
          type Target = LeftA | LeftB extends Promise<infer R> | Array<infer U> ? [R, U] : never
        `,
		)
		const leftA = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "LeftA")
		const leftB = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "LeftB")
		const inferEntries = types.filter(x => x.sourceKind === "typeInfer")
		assert.ok(leftA)
		assert.ok(leftB)
		assert.equal(inferEntries.length, 2)
		for (const inferEntry of inferEntries) {
			const builtFrom = new Set(inferEntry.builtFrom.map(item => item.typeId))
			assert.equal(builtFrom.has(leftA.id), true)
			assert.equal(builtFrom.has(leftB.id), true)
			assert.equal(builtFrom.has(inferEntry.id), false)
		}
	})

	it("keeps builtFrom empty for isolated aliases", () => {
		const { types } = readTypesWithAst(
			"./built-from-empty.ts",
			`
          type Alone = string
        `,
		)
		const alone = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "Alone")
		assert.ok(alone)
		assert.deepEqual(alone.builtFrom, [])
	})

	it("links typeParam entries to their parent declaration id and index", () => {
		const { types } = readTypesWithAst(
			"./type-param-parent.ts",
			`
          type Pair<A, B> = [A, B]
          function fn<T>(value: T): T { return value }
          interface I<T> {
            m<U>(x: U): U
          }
          class C<X> {
            n<Y>(y: Y): Y { return y }
          }
        `,
		)

		assert.ok(types.every(t => t.sourceKind !== "typeParam" || typeof t.parent.typeId === "string"))
		assert.ok(types.every(t => t.sourceKind !== "typeParam" || Number.isInteger(t.parent.argumentIndex)))

		for (const t of types) {
			if (t.sourceKind === "typeParam") {
				assert.ok(t.parent.typeId.length > 0)
				assert.ok(types.some(x => x.id === t.parent.typeId))
			} else {
				assert.equal(t.parent.typeId, "")
				assert.equal(t.parent.argumentIndex, 0)
			}
		}

		const pair = types.find(x => x.sourceKind === "typeDeclaration" && x.name === "Pair")
		const fn = types.find(x => x.sourceKind === "functionEntity" && x.name === "fn")
		const iface = types.find(x => x.sourceKind === "interface" && x.name === "I")
		const cls = types.find(x => x.sourceKind === "classEntity" && x.name === "C")
		const ifaceMethod = types.find(x => x.sourceKind === "methodSignatureEntity" && x.name === "m")
		const classMethod = types.find(x => x.sourceKind === "classMethodEntity" && x.name === "n")
		assert.ok(pair)
		assert.ok(fn)
		assert.ok(iface)
		assert.ok(cls)
		assert.ok(ifaceMethod)
		assert.ok(classMethod)

		const byName = (kind: (typeof types)[number]["sourceKind"], name: string) =>
			types.filter(x => x.sourceKind === kind && x.name === name)

		const pairA = byName("typeParam", "A").find(x => x.parent.typeId === pair.id)
		const pairB = byName("typeParam", "B").find(x => x.parent.typeId === pair.id)
		assert.ok(pairA)
		assert.ok(pairB)
		assert.equal(pairA.parent.argumentIndex, 0)
		assert.equal(pairB.parent.argumentIndex, 1)

		const fnT = byName("typeParam", "T").find(x => x.parent.typeId === fn.id)
		assert.ok(fnT)
		assert.equal(fnT.parent.argumentIndex, 0)

		const iT = byName("typeParam", "T").find(x => x.parent.typeId === iface.id)
		assert.ok(iT)
		assert.equal(iT.parent.argumentIndex, 0)

		const iU = byName("typeParam", "U").find(x => x.parent.typeId === ifaceMethod.id)
		assert.ok(iU)
		assert.equal(iU.parent.argumentIndex, 0)

		const cX = byName("typeParam", "X").find(x => x.parent.typeId === cls.id)
		assert.ok(cX)
		assert.equal(cX.parent.argumentIndex, 0)

		const cY = byName("typeParam", "Y").find(x => x.parent.typeId === classMethod.id)
		assert.ok(cY)
		assert.equal(cY.parent.argumentIndex, 0)
	})

	it("has every typeParam parent.typeId equal to some types[].id", () => {
		const { types } = readTypesWithAst(
			"./type-param-parent-ids.ts",
			`
          type Foo<S, T> = [S, T]
          function g<U>(x: U): U { return x }

          type X<T> = 1
          type A<T> = T extends infer P ? 1 extends T ? [1, X<P>] : [2, T] : never
          type B<T> = A<T> extends [infer T1, infer T2] ? [T1, T2] : [0, T]
        `,
		)
		const ids = new Set(types.map(e => e.id))
		const typeParams = types.filter(t => t.sourceKind === "typeParam")
		assert.ok(typeParams.length >= 3)
		for (const p of typeParams) {
			assert.ok(
				ids.has(p.parent.typeId),
				`parent.typeId ${JSON.stringify(p.parent.typeId)} for typeParam ${p.name} must appear as types[].id`,
			)
			const parentEntry = types.find(e => e.id === p.parent.typeId)
			assert.ok(parentEntry, "parent entry must be found by id in the same types array")
			assert.notEqual(p.id, p.parent.typeId)
		}
	})
})
