import { describe, it } from "node:test"
import type { ParseSqlStatementsRecovering } from "../parser/parse-sql-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SkippedStatement } from "../parser/skip-statement.js"

type Empty = ParseSqlStatementsRecovering<ParseSqlTokens<``>>
type _Empty = Expect<Matches<Empty, [readonly [], EmptyTokenList]>>

type One = ParseSqlStatementsRecovering<ParseSqlTokens<`create schema if not exists app`>>
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
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				{ readonly kind: "create_schema"; readonly name: "b"; readonly ifNotExists: false },
			],
			EmptyTokenList,
		]
	>
>

type UnknownSecond = ParseSqlStatementsRecovering<ParseSqlTokens<`create schema a; select 1;`>>
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

type InvalidSecond = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create schema a; create table broken (id); create schema b`>
>
type _InvalidSecond = Expect<
	Matches<
		InvalidSecond,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				SqlParserError<"Invalid column definition">,
			],
			ParseSqlTokens<`create table broken (id); create schema b`>,
		]
	>
>

describe("sql parse statements recovering", () => {
	it("should run", () => {})
})
