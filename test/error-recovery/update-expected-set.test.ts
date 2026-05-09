import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: UPDATE with missing SET

type Result = ParseErrorneousText<"update users where id = 1">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1301, "Expected SET after table in UPDATE">>

it("UPDATE: Expected SET in UPDATE", () => {})
