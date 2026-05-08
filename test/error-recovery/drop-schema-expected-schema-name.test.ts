import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP SCHEMA with missing schema name

type Result = ParseErrorneousText<"drop schema where">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 3800, "Expected schema name in DROP SCHEMA">>

it("DROP SCHEMA: Expected schema name in DROP SCHEMA", () => {})
