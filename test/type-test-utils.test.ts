import { describe, it } from "node:test"
import { expectType, toBe } from "./test-utils/type-test-utils.ts"

expectType<{ a: 1 }>(toBe<{ a: 1 }>())

describe("type test utils", () => {
	it("should run", () => {})
})
