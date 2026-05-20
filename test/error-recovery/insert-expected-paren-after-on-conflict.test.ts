import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT with missing opening parenthesis

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict where">

expectType<Result>(toBe<ErrorneousResult<1211, "Expected `(` after ON CONFLICT in INSERT">>())

it("INSERT: Expected `(` after ON CONFLICT in INSERT", () => {})
