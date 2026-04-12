import type { ParseSqlStatements } from "../parser/parse-sql-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type CreateAuth = ParseSqlStatements<
	ParseSqlTokens<`
	create schema auth
`>
>
type _CreateAuth = Expect<
	Matches<
		CreateAuth,
		[
			readonly [
				{
					readonly kind: "create_schema"
					readonly name: "auth"
					readonly ifNotExists: false
				},
			],
			EmptyTokenList,
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
			readonly [
				{
					readonly kind: "create_schema"
					readonly name: "auth"
					readonly ifNotExists: true
				},
			],
			EmptyTokenList,
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
			readonly [
				{
					readonly kind: "create_schema"
					readonly name: "auth"
					readonly ifNotExists: false
				},
			],
			EmptyTokenList,
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
			readonly [
				{
					readonly kind: "create_schema"
					readonly name: "my schema"
					readonly ifNotExists: false
				},
			],
			EmptyTokenList,
		]
	>
>

type BadStatement = ParseSqlStatements<ParseSqlTokens<`create view v as select 1;`>>
type _BadStatement = Expect<Matches<BadStatement, [readonly [{ readonly kind: "skipped-statement" }], EmptyTokenList]>>

describe("sql create schema", () => {
	it("should run", () => {})
})
