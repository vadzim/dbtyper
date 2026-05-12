import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP SCHEMA IF with missing EXISTS

type Result = ParseErrorneousText<"drop schema if myschema">

type _resultMatches = Expect<CheckErrorneousResult<Result, 3802, "Expected `exists` after `IF` in DROP SCHEMA">>

it("DROP SCHEMA: Expected `exists` after `IF` in DROP SCHEMA", () => {})
