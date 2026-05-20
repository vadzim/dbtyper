import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE RENAME COLUMN with missing TO

type Result = ParseErrorneousText<"alter table users rename column name newname">

expectType<Result>(toBe<ErrorneousResult<5400, "Expected TO in RENAME COLUMN">>())

it("ALTER TABLE: Expected TO in RENAME COLUMN", () => {})
