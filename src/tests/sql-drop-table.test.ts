import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

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

type BadDrop = SqlStatements<InitBuffer<`drop table public.`>>
type _BadDrop = Expect<
	Matches<BadDrop, [SqlParseError<"Unable to parse DROP TABLE statement">, InitBuffer<`drop table public.`>]>
>

describe("sql drop table", () => {
	it("should run", () => {})
})
