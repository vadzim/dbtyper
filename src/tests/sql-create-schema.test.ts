import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type CreateAuth = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type CreateAuthIfNotExists = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type CreateAuthSemicolon = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type CreateQuoted = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type BadStatement = SqlStatements<InitBuffer<`create view v as select 1`>>
type _BadStatement = Expect<
	Matches<BadStatement, [SqlParseError<"Unknown sql statement">, InitBuffer<`create view v as select 1`>]>
>

describe("sql create schema", () => {
	it("should run", () => {})
})
