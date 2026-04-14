import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseOpaqueCliArgs } from "../opaque-cli-args.ts"

describe("parseOpaqueCliArgs", () => {
	it("parses --consumer file Type (no indexes → all type arguments)", () => {
		const r = parseOpaqueCliArgs([
			"--opaque",
			"./opaque.ts",
			"Opaque",
			"--consumer",
			"./cons.ts",
			"Type",
			"src/**/*.ts",
		])
		assert.deepEqual(r.opaqueTypes, [{ fileName: "./opaque.ts", typeName: "Opaque" }])
		assert.deepEqual(r.opaqueConsumers, [{ fileName: "./cons.ts", typeName: "Type" }])
		assert.deepEqual(r.globs, ["src/**/*.ts"])
	})

	it("parses --consumer file Type:0", () => {
		const r = parseOpaqueCliArgs([
			"--opaque",
			"o.ts",
			"O",
			"--consumer",
			"a.ts",
			"Type:0",
			"g",
		])
		assert.deepEqual(r.opaqueConsumers, [
			{ fileName: "./a.ts", typeName: "Type", typeArgumentIndexes: [0] },
		])
	})

	it("parses --consumer file Type:1:2", () => {
		const r = parseOpaqueCliArgs([
			"--opaque",
			"o.ts",
			"O",
			"--consumer",
			"a.ts",
			"Type:1:2",
			"g",
		])
		assert.deepEqual(r.opaqueConsumers, [
			{ fileName: "./a.ts", typeName: "Type", typeArgumentIndexes: [1, 2] },
		])
	})

	it("treats --consume as an alias of --consumer", () => {
		const withConsumer = parseOpaqueCliArgs([
			"--opaque",
			"o.ts",
			"O",
			"--consumer",
			"x.ts",
			"Foo:0",
			"g",
		])
		const withConsumeAlias = parseOpaqueCliArgs([
			"--opaque",
			"o.ts",
			"O",
			"--consume",
			"x.ts",
			"Foo:0",
			"g",
		])
		assert.deepEqual(withConsumer, withConsumeAlias)
	})

	it("accepts --opaque-consumer as an alias", () => {
		const r = parseOpaqueCliArgs([
			"--opaque",
			"o.ts",
			"O",
			"--opaque-consumer",
			"y.ts",
			"Bar",
			"g",
		])
		assert.deepEqual(r.opaqueConsumers, [{ fileName: "./y.ts", typeName: "Bar" }])
	})
})
