import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: UPDATE SET with missing column name

type Result = ParseErrorneousText<"update users set = 1">

expectType<Result>(toBe<ErrorneousResult<1206, "Expected column name in UPDATE SET">>())

it("UPDATE: Expected column name in UPDATE SET", () => {})
