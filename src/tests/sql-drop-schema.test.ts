import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type DropAuth = SqlStatements<
	ParseSqlTokens<`
	drop schema if exists auth;
`>
>
type _DropAuth = Expect<
	Matches<
		DropAuth,
		[
			readonly [
				{
					readonly kind: "drop_schema"
					readonly name: "auth"
					readonly ifExists: true
				},
			],
			EmptyTokenList,
		]
	>
>

type DropBilling = SqlStatements<
	ParseSqlTokens<`
	drop schema billing
`>
>
type _DropBilling = Expect<
	Matches<
		DropBilling,
		[
			readonly [
				{
					readonly kind: "drop_schema"
					readonly name: "billing"
					readonly ifExists: false
				},
			],
			EmptyTokenList,
		]
	>
>

type BadDrop = SqlStatements<ParseSqlTokens<`drop schema auth.`>>
type _BadDrop = Expect<
	Matches<BadDrop, [SqlParserError<"Unable to parse DROP SCHEMA statement">, ParseSqlTokens<`drop schema auth.`>]>
>

describe("sql drop schema", () => {
	it("should run", () => {})
})
