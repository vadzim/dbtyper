import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE ALTER COLUMN DROP NOT with missing NULL

type Result = ParseErrorneousText<"alter table users alter column name drop not">

type _resultMatches = Expect<CheckErrorneousResult<Result, "Expected NULL after DROP NOT">>

it("ALTER TABLE: Expected NULL after DROP NOT", () => {})
