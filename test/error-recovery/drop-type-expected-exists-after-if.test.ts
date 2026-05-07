import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP TYPE IF with missing EXISTS

type Result = ParseErrorneousText<"drop type if mytype">

type _resultMatches = Expect<CheckErrorneousResult<Result, "Expected `exists` after `IF` in DROP TYPE">>

it("DROP TYPE: Expected `exists` after `IF` in DROP TYPE", () => {})
