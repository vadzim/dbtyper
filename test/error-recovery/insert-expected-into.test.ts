import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT with missing INTO

type Result = ParseErrorneousText<"insert users (id) values (1)">

expectType<Result>(toBe<ErrorneousResult<1200, "Expected INTO after INSERT">>())

it("INSERT: Expected INTO after INSERT", () => {})
