import { describe, it } from "node:test"
import type { ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError, TokenType } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { SkippedStatement } from "../src/parser/skip-statement.ts"

type Empty = ParseSqlStatementsRecovering<ParseSqlTokens<``>>
type _Empty = Expect<Matches<Empty, [EmptyTokenList, []]>>

type One = ParseSqlStatementsRecovering<ParseSqlTokens<`create schema if not exists app`>>
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

type Two = ParseSqlStatementsRecovering<
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

type UnknownSecond = ParseSqlStatementsRecovering<ParseSqlTokens<`create schema a; select 1;`>>
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

type InvalidSecond = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create schema a; create table broken (id); create schema b`>
>
type _InvalidSecond = Expect<
	Matches<
		InvalidSecond[1],
		[{ kind: "create_schema"; name: "a"; ifNotExists: false }, SqlParserError<"Invalid column definition">]
	>
>

describe("sql parse statements recovering", () => {
	it("should run", () => {})
})
