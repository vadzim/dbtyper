import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE DROP COLUMN with missing column name

type Result = ParseErrorneousText<"alter table users drop column">

expectType<Result>(toBe<ErrorneousResult<1206, "Expected column name after DROP COLUMN">>())

it("ALTER TABLE: Expected column name after DROP COLUMN", () => {})
