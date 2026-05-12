import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA IF with missing NOT

type Result = ParseErrorneousText<"create schema if myschema">

type _resultMatches = Expect<CheckErrorneousResult<Result, 3702, "Expected `not` after `IF` in CREATE SCHEMA">>

it("CREATE SCHEMA: Expected `not` after `IF` in CREATE SCHEMA", () => {})
