import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: UPDATE with missing SET

type Result = ParseErrorneousText<"update users where id = 1">

expectType<Result>(toBe<ErrorneousResult<1301, "Expected SET after table in UPDATE">>())

it("UPDATE: Expected SET in UPDATE", () => {})
