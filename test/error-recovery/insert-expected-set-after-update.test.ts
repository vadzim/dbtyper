import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT DO UPDATE with missing SET

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict (id) do update id = 2">

expectType<Result>(toBe<ErrorneousResult<1217, "Expected SET after UPDATE in INSERT ON CONFLICT">>())

it("INSERT: Expected SET after UPDATE in INSERT ON CONFLICT", () => {})
