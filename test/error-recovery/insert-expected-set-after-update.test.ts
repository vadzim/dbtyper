import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT DO UPDATE with missing SET

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict (id) do update id = 2">

type _resultMatches = Expect<CheckErrorneousResult<Result, 1217, "Expected SET after UPDATE in INSERT ON CONFLICT">>

it("INSERT: Expected SET after UPDATE in INSERT ON CONFLICT", () => {})
