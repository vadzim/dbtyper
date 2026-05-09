import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE ALTER COLUMN with unsupported TYPE/SET/DROP clause

type Result = ParseErrorneousText<"alter table users alter column name">

type _resultMatches = Expect<
	CheckErrorneousResultWithCode<Result, 1608, "Expected TYPE, SET, or DROP after ALTER COLUMN">
>

it("ALTER TABLE: Expected TYPE, SET, or DROP after ALTER COLUMN", () => {})
