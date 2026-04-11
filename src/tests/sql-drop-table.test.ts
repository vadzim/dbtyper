import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type DropUsers = SqlStatements<
	InitBuffer<`
	drop table if exists public.users;
`>
>
type _DropUsers = Expect<
	Matches<
		DropUsers,
		[
			readonly [
				{
					readonly kind: "drop_table"
					readonly target: readonly ["users", "public"]
					readonly ifExists: true
				},
			],
			EmptyBuffer,
		]
	>
>

type BadDrop = SqlStatements<InitBuffer<`drop view public.users`>>[0]
type _BadDrop = ExpectFalse<Matches<BadDrop, { readonly kind: "drop_table" }>>

describe("sql drop table", () => {
	it("should run", () => {})
})
