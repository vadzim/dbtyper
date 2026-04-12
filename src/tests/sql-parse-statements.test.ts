import { describe, it } from "node:test"
import type { ParseSqlStatements } from "../parser/parse-sql-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SkippedStatement } from "../parser/skip-statement.js"

type Empty = ParseSqlStatements<ParseSqlTokens<``>>
type _Empty = Expect<Matches<Empty, [readonly [], EmptyTokenList]>>

type One = ParseSqlStatements<ParseSqlTokens<`create schema if not exists app`>>
type _One = Expect<
	Matches<
		One,
		[
			readonly [
				{
					readonly kind: "create_schema"
					readonly name: "app"
					readonly ifNotExists: true
				},
			],
			EmptyTokenList,
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
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				{ readonly kind: "create_schema"; readonly name: "b"; readonly ifNotExists: false },
			],
			EmptyTokenList,
		]
	>
>

/** First failure is only `[error, buffer]` — prior successful parses are not returned. */
type UnknownSecond = ParseSqlStatements<ParseSqlTokens<`create schema a; select 1;`>>
type _UnknownSecond = Expect<
	Matches<
		UnknownSecond,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
			EmptyTokenList,
		]
	>
>

type InvalidSecond = ParseSqlStatements<ParseSqlTokens<`create schema a; create table broken (id); create schema b`>>
type _InvalidSecond = Expect<
	Matches<
		InvalidSecond,
		[SqlParserError<"Invalid column definition">, ParseSqlTokens<`create table broken (id); create schema b`>]
	>
>

describe("sql parse statements", () => {
	it("should run", () => {})
})
