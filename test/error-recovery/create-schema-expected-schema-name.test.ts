import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA with missing schema name

type Result = ParseErrorneousText<"create schema">

type _resultMatches = Expect<CheckErrorneousResult<Result, 3700, "Expected schema name in CREATE SCHEMA">>

it("CREATE SCHEMA: Expected schema name in CREATE SCHEMA", () => {})
