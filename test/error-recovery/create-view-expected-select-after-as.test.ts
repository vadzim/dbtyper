import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE VIEW with missing SELECT after AS

type Result = ParseErrorneousText<"create view myview as insert into users (id) values (1)">

type _resultMatches = Expect<CheckErrorneousResultWithCode<Result, 1104, "Expected SELECT or WITH after AS in CREATE VIEW">>

it("CREATE VIEW: Expected SELECT or WITH after AS in CREATE VIEW", () => {})
