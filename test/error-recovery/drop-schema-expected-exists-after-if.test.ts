import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP SCHEMA IF with missing EXISTS

type Result = ParseErrorneousText<"drop schema if myschema">

expectType<Result>(toBe<ErrorneousResult<3802, "Expected `exists` after `IF` in DROP SCHEMA">>())

it("DROP SCHEMA: Expected `exists` after `IF` in DROP SCHEMA", () => {})
