import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TABLE RENAME COLUMN with missing old column name

type Result = ParseErrorneousText<"alter table users rename column to newname">

expectType<Result>(toBe<ErrorneousResult<5401, "Expected old column name in RENAME COLUMN">>())

it("ALTER TABLE: Expected old column name in RENAME COLUMN", () => {})
