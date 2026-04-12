import type { ParseSqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type DropUsers = ParseSqlStatements<
	ParseSqlTokens<`
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
			EmptyTokenList,
		]
	>
>

type BadDrop = ParseSqlStatements<ParseSqlTokens<`drop table public.`>>
type _BadDrop = Expect<
	Matches<BadDrop, [SqlParserError<"Unable to parse DROP TABLE statement">, ParseSqlTokens<`drop table public.`>]>
>

describe("sql drop table", () => {
	it("should run", () => {})
})
