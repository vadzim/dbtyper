import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT with missing DO

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict (id) nothing">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1214, "Expected DO after ON CONFLICT column list in INSERT">>

it("INSERT: Expected DO after ON CONFLICT column list in INSERT", () => {})
