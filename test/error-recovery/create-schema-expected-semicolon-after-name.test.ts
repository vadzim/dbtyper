import { it } from "node:test"
import type { Expect } from "../test-utils/type-test-utils.ts"
import type { CheckErrorneousResultWithCode, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE SCHEMA with missing semicolon

type Result = ParseErrorneousText<"create schema myschema trailing">

type _resultMatches = Expect<
	CheckErrorneousResultWithCode<Result, 1105, "Expected semicolon after schema name in CREATE SCHEMA">
>

it("CREATE SCHEMA: Expected `;` after schema name in CREATE SCHEMA", () => {})
