import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT with missing INTO

type Result = ParseErrorneousText<"insert users (id) values (1)">

type _resultMatches = Expect<CheckErrorneousResult<Result, 1200, "Expected INTO after INSERT">>

it("INSERT: Expected INTO after INSERT", () => {})
