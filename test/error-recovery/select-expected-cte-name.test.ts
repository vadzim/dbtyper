import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: WITH clause with missing CTE name

type Result = ParseErrorneousText<"with as (select id from users) select id from users">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1111, "Expected CTE name in WITH">>

it("SELECT: Expected CTE name in WITH", () => {})
