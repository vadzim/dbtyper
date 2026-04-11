import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { InitBuffer } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type CreateAuth = SqlStatements<InitBuffer<`create schema auth`>>[0][0]
type _CreateAuth = Expect<
	Matches<
		CreateAuth,
		{
			readonly kind: "create_schema"
			readonly name: "auth"
			readonly ifNotExists: false
		}
	>
>

type CreateAuthIfNotExists = SqlStatements<InitBuffer<`create schema if not exists auth`>>[0][0]
type _CreateAuthIfNotExists = Expect<
	Matches<
		CreateAuthIfNotExists,
		{
			readonly kind: "create_schema"
			readonly name: "auth"
			readonly ifNotExists: true
		}
	>
>

type CreateAuthSemicolon = SqlStatements<InitBuffer<`create schema auth;`>>[0][0]
type _CreateAuthSemicolon = Expect<
	Matches<
		CreateAuthSemicolon,
		{
			readonly kind: "create_schema"
			readonly name: "auth"
			readonly ifNotExists: false
		}
	>
>

type CreateQuoted = SqlStatements<InitBuffer<`create schema "my schema"`>>[0][0]
type _CreateQuoted = Expect<
	Matches<
		CreateQuoted,
		{
			readonly kind: "create_schema"
			readonly name: "my schema"
			readonly ifNotExists: false
		}
	>
>

type BadStatement = SqlStatements<InitBuffer<`create view v as select 1`>>[0]
type _BadStatement = ExpectFalse<Matches<BadStatement, { readonly kind: "create_schema" }>>

describe("sql create schema", () => {
	it("should run", () => {})
})
