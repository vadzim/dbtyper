import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT with missing opening parenthesis after VALUES

type Result = ParseErrorneousText<"insert into users (id) values where">

type _resultMatches = Expect<CheckErrorneousResult<Result, 1202, "Expected `(` after VALUES in INSERT">>

it("INSERT: Expected `(` after VALUES in INSERT", () => {})
