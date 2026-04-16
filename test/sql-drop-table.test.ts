import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type DropUsers = ParseSqlStatements<
	ParseSqlTokens<`
	drop table if exists public.users;
`>
>
type _DropUsers = Expect<
	Matches<
		DropUsers,
		[
			EmptyTokenList,
			[
				{
					kind: "drop_table"
					target: ["users", "public"]
					ifExists: true
				},
			],
		]
	>
>

type BadDrop = ParseSqlStatements<ParseSqlTokens<`drop table public.`>>
type _BadDrop = Expect<Matches<BadDrop[1], SqlParserError<"Unable to parse DROP TABLE statement">>>

describe("sql drop table", () => {
	it("should run", () => {})
})
