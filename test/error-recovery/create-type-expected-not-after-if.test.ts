import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE TYPE IF with missing NOT

type Result = ParseErrorneousText<"create type if status as enum ('active', 'inactive')">

type _resultMatches = Expect<CheckErrorneousResult<Result, "Expected `not` after `IF` in CREATE TYPE">>

it("CREATE TYPE: Expected `not` after `IF` in CREATE TYPE", () => {})
