import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

export type ExpectDoesntMatch<T extends false> = T

type _MatchesAnyLeftIsFalse = ExpectDoesntMatch<Matches<any, string>>
type _MatchesAnyRightIsFalse = ExpectDoesntMatch<Matches<string, any>>
type _MatchesAnyAnyIsFalse = ExpectDoesntMatch<Matches<any, any>>
type _MatchesAnyDeepIsFalse = ExpectDoesntMatch<Matches<{ a: any }, { a: any }>>

type _MatchesNonAnyStillWorks = Expect<Matches<{ a: 1 }, { a: 1 }>>

describe("type test utils", () => {
	it("should run", () => {})
})
