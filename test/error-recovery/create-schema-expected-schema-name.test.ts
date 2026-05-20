import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA with missing schema name

type Result = ParseErrorneousText<"create schema">

expectType<Result>(toBe<ErrorneousResult<3700, "Expected schema name in CREATE SCHEMA">>())

it("CREATE SCHEMA: Expected schema name in CREATE SCHEMA", () => {})
