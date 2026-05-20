import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DELETE with missing FROM

type Result = ParseErrorneousText<"delete users">

expectType<Result>(toBe<ErrorneousResult<1400, "Expected FROM after DELETE">>())

it("DELETE: Expected FROM after DELETE", () => {})
