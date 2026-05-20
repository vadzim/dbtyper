import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: CREATE TABLE IF with missing NOT

type Result = ParseErrorneousText<"create table if users (id int)">

expectType<Result>(toBe<ErrorneousResult<1507, "Expected `not` after `IF` in CREATE TABLE">>())

it("CREATE TABLE: Expected `not` after `IF` in CREATE TABLE", () => {})
