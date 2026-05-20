import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA IF with missing NOT

type Result = ParseErrorneousText<"create schema if myschema">

expectType<Result>(toBe<ErrorneousResult<3702, "Expected `not` after `IF` in CREATE SCHEMA">>())

it("CREATE SCHEMA: Expected `not` after `IF` in CREATE SCHEMA", () => {})
