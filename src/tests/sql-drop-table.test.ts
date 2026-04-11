import type { SqlStatementLoose } from "../parser/sql-parse-statement.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type DropUsers = SqlStatementLoose<`drop table if exists public.users;`>
type _DropUsers = Expect<
	Matches<
		DropUsers,
		{
			readonly kind: "drop_table"
			readonly target: readonly ["users", "public"]
			readonly ifExists: true
		}
	>
>

type BadDrop = SqlStatementLoose<`drop view public.users`>
type _BadDrop = ExpectFalse<Matches<BadDrop, { readonly kind: "drop_table" }>>

describe("sql drop table", () => {
	it("should run", () => {})
})
