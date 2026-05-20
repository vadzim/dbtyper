import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: INSERT ON CONFLICT DO UPDATE SET with missing column name

type Result = ParseErrorneousText<"insert into users (id) values (1) on conflict (id) do update set = 2">

expectType<Result>(toBe<ErrorneousResult<1206, "Expected column name in ON CONFLICT UPDATE">>())

it("INSERT: Expected column name in ON CONFLICT UPDATE", () => {})
