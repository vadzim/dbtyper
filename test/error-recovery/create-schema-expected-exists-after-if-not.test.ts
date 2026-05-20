import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA IF NOT with missing EXISTS

type Result = ParseErrorneousText<"create schema if not myschema">

expectType<Result>(toBe<ErrorneousResult<3703, "Expected `exists` after `IF NOT` in CREATE SCHEMA">>())

it("CREATE SCHEMA: Expected `exists` after `IF NOT` in CREATE SCHEMA", () => {})
