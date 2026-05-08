import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP TABLE IF with missing EXISTS

type Result = ParseErrorneousText<"drop table if users">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1702, "Expected `exists` after `IF` in DROP TABLE">>

it("DROP TABLE: Expected `exists` after `IF` in DROP TABLE", () => {})
