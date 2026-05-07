import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE VIEW with missing AS keyword

type Result = ParseErrorneousText<"create view newview select id from users">

type _resultMatches = Expect<CheckErrorneousResult<Result, "Expected AS or `.` before view name">>

it("CREATE VIEW: Expected AS or `.` before view name", () => {})
