import { describe, it } from "node:test"
import type { SqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type Empty = SqlStatementsRecovering<InitBuffer<``>>
type _Empty = Expect<Matches<Empty, [readonly [], EmptyBuffer]>>

type One = SqlStatementsRecovering<InitBuffer<`create schema if not exists app`>>
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
			EmptyBuffer,
		]
	>
>

type Two = SqlStatementsRecovering<InitBuffer<`create schema a; create schema b`>>
type _Two = Expect<
	Matches<
		Two,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				{ readonly kind: "create_schema"; readonly name: "b"; readonly ifNotExists: false },
			],
			EmptyBuffer,
		]
	>
>

type UnknownSecond = SqlStatementsRecovering<InitBuffer<`create schema a; select 1`>>
type _UnknownSecond = Expect<
	Matches<
		UnknownSecond,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				SqlParseError<"Unknown sql statement">,
			],
			InitBuffer<`select 1`>,
		]
	>
>

type InvalidSecond = SqlStatementsRecovering<InitBuffer<`create schema a; create table broken (id); create schema b`>>
type _InvalidSecond = Expect<
	Matches<
		InvalidSecond,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "a"; readonly ifNotExists: false },
				SqlParseError<"Invalid column definition">,
			],
			InitBuffer<`create table broken (id); create schema b`>,
		]
	>
>

describe("sql parse statements", () => {
	it("should run", () => {})
})
