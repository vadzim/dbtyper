import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP TYPE IF with missing EXISTS

type Result = ParseErrorneousText<"drop type if mytype">

expectType<Result>(toBe<ErrorneousResult<1817, "Expected `exists` after `IF` in DROP TYPE">>())

it("DROP TYPE: Expected `exists` after `IF` in DROP TYPE", () => {})
