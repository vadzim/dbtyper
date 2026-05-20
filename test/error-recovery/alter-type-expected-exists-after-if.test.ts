import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: ALTER TYPE IF with missing EXISTS

type Result = ParseErrorneousText<"alter type if status add value 'pending'">

expectType<Result>(toBe<ErrorneousResult<4000, "Expected `exists` after `IF` in ALTER TYPE">>())

it("ALTER TYPE: Expected `exists` after `IF` in ALTER TYPE", () => {})
