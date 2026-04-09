import { describe, it } from "node:test"
import type { ExpectFalse, Expect, Matches } from "../test-utils/type-test-utils.js"

type _MatchesAnyLeftIsFalse = ExpectFalse<Matches<any, string>>
type _MatchesAnyRightIsFalse = ExpectFalse<Matches<string, any>>
type _MatchesAnyAnyIsFalse = ExpectFalse<Matches<any, any>>
type _MatchesAnyDeepIsFalse = ExpectFalse<Matches<{ a: any }, { a: any }>>

type _MatchesNonAnyStillWorks = Expect<Matches<{ a: 1 }, { a: 1 }>>

describe("type test utils", () => {
	it("should run", () => {})
})
