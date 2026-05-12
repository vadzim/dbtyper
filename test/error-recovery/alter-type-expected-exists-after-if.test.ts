import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TYPE IF with missing EXISTS

type Result = ParseErrorneousText<"alter type if status add value 'pending'">

type _resultMatches = Expect<CheckErrorneousResult<Result, 4000, "Expected `exists` after `IF` in ALTER TYPE">>

it("ALTER TYPE: Expected `exists` after `IF` in ALTER TYPE", () => {})
