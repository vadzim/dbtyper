import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE ALTER COLUMN with unsupported TYPE/SET/DROP clause

type Result = ParseErrorneousText<"alter table users alter column name">

expectType<Result>(toBe<ErrorneousResult<1608, "Expected TYPE, SET, or DROP after ALTER COLUMN">>())

it("ALTER TABLE: Expected TYPE, SET, or DROP after ALTER COLUMN", () => {})
