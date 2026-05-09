import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: UPDATE SET with missing equals sign

type Result = ParseErrorneousText<"update users set id 1">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1304, "Expected `=` after column in UPDATE SET">>

it("UPDATE: Expected `=` after column in UPDATE SET", () => {})
