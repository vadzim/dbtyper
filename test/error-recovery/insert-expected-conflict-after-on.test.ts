import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON with missing CONFLICT

type Result = ParseErrorneousText<"insert into users (id) values (1) on do nothing">

expectType<Result>(toBe<ErrorneousResult<1210, "Expected CONFLICT after ON in INSERT">>())

it("INSERT: Expected CONFLICT after ON in INSERT", () => {})
