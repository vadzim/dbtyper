import { it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ErrorneousResult, ParseErrorneousText } from "../test-utils/error-test-utils.ts"

// Test: WITH clause with missing SELECT

type Result = ParseErrorneousText<"with cte as (select id from users) create table x (id integer)">

expectType<Result>(toBe<ErrorneousResult<1100, "Expected SELECT, INSERT, UPDATE or DELETE after WITH clause">>())

it("SELECT: Expected SELECT after WITH clause", () => {})
