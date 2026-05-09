import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE RENAME COLUMN with missing TO

type Result = ParseErrorneousText<"alter table users rename column name newname">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 5400, "Expected TO in RENAME COLUMN">>

it("ALTER TABLE: Expected TO in RENAME COLUMN", () => {})
