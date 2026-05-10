import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: UPDATE SET with missing column name

type Result = ParseErrorneousText<"update users set = 1">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1206, "Expected column name in UPDATE SET">>

it("UPDATE: Expected column name in UPDATE SET", () => {})
