import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT with missing DO

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict (id) nothing">

expectType<Result>(toBe<ErrorneousResult<1214, "Expected DO after ON CONFLICT column list in INSERT">>())

it("INSERT: Expected DO after ON CONFLICT column list in INSERT", () => {})
