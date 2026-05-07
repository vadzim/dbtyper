import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: SELECT with missing FROM after SELECT list

type Result = ParseErrorneousText<"select id">

type _resultMatches = Expect<CheckErrorneousResult<Result, "Expected FROM after SELECT list">>

it("SELECT: Expected FROM after SELECT list", () => {})
