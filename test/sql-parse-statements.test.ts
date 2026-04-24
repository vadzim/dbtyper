import { describe, it } from "node:test"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError, TokenType } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type Empty = ParseSqlStatements<ParseSqlTokens<``>>
type _Empty = Expect<Matches<Empty, [EmptyTokenList, []]>>

type One = ParseSqlStatements<ParseSqlTokens<`create schema if not exists app`>>
type _One = Expect<
	Matches<
		One,
		[
			EmptyTokenList,
			[
				{
					kind: "create_schema"
					name: "app"
					ifNotExists: true
				},
			],
		]
	>
>

type Two = ParseSqlStatements<
	ParseSqlTokens<`
	create schema a;
	create schema b
`>
>
type _Two = Expect<
	Matches<
		Two,
		[
			EmptyTokenList,
			[
				{ kind: "create_schema"; name: "a"; ifNotExists: false },
				{ kind: "create_schema"; name: "b"; ifNotExists: false },
			],
		]
	>
>

/** First failure is only `[error, buffer]` — prior successful parses are not returned. */
type UnknownSecond = ParseSqlStatements<ParseSqlTokens<`create schema a; select 1;`>>
type _UnknownSecond = Expect<
	Matches<
		UnknownSecond,
		[
			EmptyTokenList,
			[
				{ kind: "create_schema"; name: "a"; ifNotExists: false },
				{
					kind: "skipped-statement"
					token: TokenType<";">
				},
			],
		]
	>
>

type InvalidSecond = ParseSqlStatements<ParseSqlTokens<`create schema a; create table broken (id); create schema b`>>
type _InvalidSecond = Expect<Matches<InvalidSecond[1], SqlParserError<"Invalid column definition">>>

describe("sql parse statements", () => {
	it("should run", () => {})
})
