import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type DropAuth = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type DropBilling = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type BadDrop = SqlStatements<InitBuffer<`drop schema auth.`>>
type _BadDrop = Expect<
	Matches<BadDrop, [SqlParseError<"Unable to parse DROP SCHEMA statement">, InitBuffer<`drop schema auth.`>]>
>

describe("sql drop schema", () => {
	it("should run", () => {})
})
