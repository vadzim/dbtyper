import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT DO with missing UPDATE

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict (id) do set id = 2">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1216, "Expected UPDATE after DO in INSERT ON CONFLICT">>

it("INSERT: Expected UPDATE after DO in INSERT ON CONFLICT", () => {})
