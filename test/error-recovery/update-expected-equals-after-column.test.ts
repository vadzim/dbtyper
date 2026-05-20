import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: UPDATE SET with missing equals sign

type Result = ParseErrorneousText<"update users set id 1">

expectType<Result>(toBe<ErrorneousResult<1304, "Expected `=` after column in UPDATE SET">>())

it("UPDATE: Expected `=` after column in UPDATE SET", () => {})
