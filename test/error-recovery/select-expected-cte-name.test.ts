import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: WITH clause with missing CTE name

type Result = ParseErrorneousText<"with as (select id from users) select id from users">

expectType<Result>(toBe<ErrorneousResult<1111, "Expected CTE name in WITH">>())

it("SELECT: Expected CTE name in WITH", () => {})
