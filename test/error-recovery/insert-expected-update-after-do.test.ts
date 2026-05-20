import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT DO with missing UPDATE

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict (id) do set id = 2">

expectType<Result>(toBe<ErrorneousResult<1216, "Expected UPDATE after DO in INSERT ON CONFLICT">>())

it("INSERT: Expected UPDATE after DO in INSERT ON CONFLICT", () => {})
