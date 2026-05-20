import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE VIEW with missing AS keyword

type Result = ParseErrorneousText<"create view newview select id from users">

expectType<Result>(toBe<ErrorneousResult<3903, "Expected AS or `.` before view name">>())

it("CREATE VIEW: Expected AS or `.` before view name", () => {})
