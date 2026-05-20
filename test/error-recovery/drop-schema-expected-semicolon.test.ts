import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP SCHEMA with missing semicolon

type Result = ParseErrorneousText<"drop schema myschema trailing">

expectType<Result>(toBe<ErrorneousResult<1105, "Expected semicolon after DROP SCHEMA">>())

it("DROP SCHEMA: Expected `;` after DROP SCHEMA", () => {})
