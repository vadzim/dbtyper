import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE DROP COLUMN with missing column name

type Result = ParseErrorneousText<"alter table users drop column">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1606, "Expected column name after DROP COLUMN">>

it("ALTER TABLE: Expected column name after DROP COLUMN", () => {})
