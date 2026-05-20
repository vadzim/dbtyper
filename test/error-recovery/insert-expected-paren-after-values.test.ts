import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT with missing opening parenthesis after VALUES

type Result = ParseErrorneousText<"insert into users (id) values where">

expectType<Result>(toBe<ErrorneousResult<1202, "Expected `(` after VALUES in INSERT">>())

it("INSERT: Expected `(` after VALUES in INSERT", () => {})
