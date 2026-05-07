import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE RENAME COLUMN with missing old column name

type Result = ParseErrorneousText<"alter table users rename column to newname">

type _resultMatches = Expect<CheckErrorneousResult<Result, "Expected old column name in RENAME COLUMN">>

it("ALTER TABLE: Expected old column name in RENAME COLUMN", () => {})
