import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA with missing semicolon

type Result = ParseErrorneousText<"create schema myschema trailing">

expectType<Result>(toBe<ErrorneousResult<1105, "Expected semicolon after schema name in CREATE SCHEMA">>())

it("CREATE SCHEMA: Expected `;` after schema name in CREATE SCHEMA", () => {})
