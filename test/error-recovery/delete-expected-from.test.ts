import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DELETE with missing FROM

type Result = ParseErrorneousText<"delete users">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1400, "Expected FROM after DELETE">>

it("DELETE: Expected FROM after DELETE", () => {})
