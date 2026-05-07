import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP SCHEMA with missing semicolon

type Result = ParseErrorneousText<"drop schema myschema trailing">

type _resultMatches = Expect<CheckErrorneousResult<Result, "Expected `;` after DROP SCHEMA">>

it("DROP SCHEMA: Expected `;` after DROP SCHEMA", () => {})
