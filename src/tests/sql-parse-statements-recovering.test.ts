import { describe, it } from "node:test"
import type { SqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParseError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type Empty = SqlStatementsRecovering<ParseSqlTokens<``>>
type _Empty = Expect<Matches<Empty, [readonly [], EmptyTokenList]>>

type One = SqlStatementsRecovering<ParseSqlTokens<`create schema if not exists app`>>
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

type Two = SqlStatementsRecovering<
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

type UnknownSecond = SqlStatementsRecovering<ParseSqlTokens<`create schema a; select 1`>>
type _UnknownSecond = Expect<
	Matches<
		UnknownSecond,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				SqlParseError<"Unknown sql statement">,
			],
			ParseSqlTokens<`select 1`>,
		]
	>
>

type InvalidSecond = SqlStatementsRecovering<
	ParseSqlTokens<`create schema a; create table broken (id); create schema b`>
>
type _InvalidSecond = Expect<
	Matches<
		InvalidSecond,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				SqlParseError<"Invalid column definition">,
			],
			ParseSqlTokens<`create table broken (id); create schema b`>,
		]
	>
>

describe("sql parse statements recovering", () => {
	it("should run", () => {})
})
