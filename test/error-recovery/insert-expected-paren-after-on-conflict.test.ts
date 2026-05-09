import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT with missing opening parenthesis

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict where">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1211, "Expected `(` after ON CONFLICT in INSERT">>

it("INSERT: Expected `(` after ON CONFLICT in INSERT", () => {})
