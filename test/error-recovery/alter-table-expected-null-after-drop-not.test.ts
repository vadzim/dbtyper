import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE ALTER COLUMN DROP NOT with missing NULL

type Result = ParseErrorneousText<"alter table users alter column name drop not">

expectType<Result>(toBe<ErrorneousResult<5004, "Expected NULL after DROP NOT">>())

it("ALTER TABLE: Expected NULL after DROP NOT", () => {})
