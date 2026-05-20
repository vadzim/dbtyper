import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: DROP SCHEMA with missing schema name

type Result = ParseErrorneousText<"drop schema where">

expectType<Result>(toBe<ErrorneousResult<3800, "Expected schema name in DROP SCHEMA">>())

it("DROP SCHEMA: Expected schema name in DROP SCHEMA", () => {})
