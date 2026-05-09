import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT with missing semicolon

type Result = ParseErrorneousText<"insert into users (id) values (1) trailing">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1201, "Expected `;` after INSERT">>

it("INSERT: Expected `;` after INSERT", () => {})
