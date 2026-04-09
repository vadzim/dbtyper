import { describe, it } from "node:test"
import type { Equal, ExpectFalse, Expect } from "./type-test-utils.js"

type _EqualAnyLeftIsFalse = ExpectFalse<Equal<any, string>>
type _EqualAnyRightIsFalse = ExpectFalse<Equal<string, any>>
type _EqualAnyAnyIsFalse = ExpectFalse<Equal<any, any>>

type _EqualNonAnyStillWorks = Expect<Equal<{ a: 1 }, { a: 1 }>>

describe("type test utils", () => {
	it("should run", () => {})
})
