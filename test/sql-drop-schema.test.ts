import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type DropAuth = ParseSqlStatements<
	ParseSqlTokens<`
	drop schema if exists auth;
`>
>
type _DropAuth = Expect<
	Matches<
		DropAuth,
		[
			EmptyTokenList,
			[
				{
					kind: "drop_schema"
					name: "auth"
					ifExists: true
				},
			],
		]
	>
>

type DropBilling = ParseSqlStatements<
	ParseSqlTokens<`
	drop schema billing
`>
>
type _DropBilling = Expect<
	Matches<
		DropBilling,
		[
			EmptyTokenList,
			[
				{
					kind: "drop_schema"
					name: "billing"
					ifExists: false
				},
			],
		]
	>
>

type BadDrop = ParseSqlStatements<ParseSqlTokens<`drop schema auth.`>>
type _BadDrop = Expect<Matches<BadDrop[1], SqlParserError<"Unable to parse DROP SCHEMA statement">>>

describe("sql drop schema", () => {
	it("should run", () => {})
})
