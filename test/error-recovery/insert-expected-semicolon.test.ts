import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT with missing semicolon

type Result = ParseErrorneousText<"insert into users (id) values (1) trailing">

expectType<Result>(toBe<ErrorneousResult<1105, "Expected semicolon after INSERT">>())

it("INSERT: Expected `;` after INSERT", () => {})
