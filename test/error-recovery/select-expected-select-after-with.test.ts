import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: WITH clause with missing SELECT

type Result = ParseErrorneousText<"with cte as (select id from users) insert into users (id) values (1)">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1100, "Expected SELECT after WITH clause">>

it("SELECT: Expected SELECT after WITH clause", () => {})
