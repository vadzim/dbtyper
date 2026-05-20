import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE TYPE IF with missing NOT

type Result = ParseErrorneousText<"create type if status as enum ('active', 'inactive')">

expectType<Result>(toBe<ErrorneousResult<1815, "Expected `not` after `IF` in CREATE TYPE">>())

it("CREATE TYPE: Expected `not` after `IF` in CREATE TYPE", () => {})
