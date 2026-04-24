import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError, TokenType } from "../core/sql-tokens.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type CreateAuth = ParseSqlStatements<
	ParseSqlTokens<`
	create schema auth
`>
>
type _CreateAuth = Expect<
	Matches<
		CreateAuth,
		[
			EmptyTokenList,
			[
				{
					kind: "create_schema"
					name: "auth"
					ifNotExists: false
				},
			],
		]
	>
>

type CreateAuthIfNotExists = ParseSqlStatements<
	ParseSqlTokens<`
	create schema if not exists auth
`>
>
type _CreateAuthIfNotExists = Expect<
	Matches<
		CreateAuthIfNotExists,
		[
			EmptyTokenList,
			[
				{
					kind: "create_schema"
					name: "auth"
					ifNotExists: true
				},
			],
		]
	>
>

type CreateAuthSemicolon = ParseSqlStatements<
	ParseSqlTokens<`
	create schema auth;
`>
>
type _CreateAuthSemicolon = Expect<
	Matches<
		CreateAuthSemicolon,
		[
			EmptyTokenList,
			[
				{
					kind: "create_schema"
					name: "auth"
					ifNotExists: false
				},
			],
		]
	>
>

type CreateQuoted = ParseSqlStatements<
	ParseSqlTokens<`
	create schema "my schema"
`>
>
type _CreateQuoted = Expect<
	Matches<
		CreateQuoted,
		[
			EmptyTokenList,
			[
				{
					kind: "create_schema"
					name: "my schema"
					ifNotExists: false
				},
			],
		]
	>
>

type BadStatement = ParseSqlStatements<ParseSqlTokens<`create view v as select 1;`>>
type _BadStatement = Expect<
	Matches<
		BadStatement,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<";">
				},
			],
		]
	>
>

describe("sql create schema", () => {
	it("should run", () => {})
})
