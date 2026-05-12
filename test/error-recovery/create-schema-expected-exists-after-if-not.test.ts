import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA IF NOT with missing EXISTS

type Result = ParseErrorneousText<"create schema if not myschema">

type _resultMatches = Expect<CheckErrorneousResult<Result, 3703, "Expected `exists` after `IF NOT` in CREATE SCHEMA">>

it("CREATE SCHEMA: Expected `exists` after `IF NOT` in CREATE SCHEMA", () => {})
